"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSendMessage } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { getLiveSocket } from "@/lib/live-socket";
import { useLiveStore } from "@/store/live-store";
import { DEMO_USER_ID } from "@/store/app-store";
import type { Booking, BookingMessage } from "@/lib/types";

/**
 * BookingChat — the shared customer↔member message thread.
 * One component serves both sides: alignment is driven by `viewerRole`.
 * Messages live on the booking, so the thread is scoped to a single service
 * and stays part of its auditable record.
 *
 * Real-time layer (socket.io → mini-services/notify, room `chat:<bookingId>`):
 *   - the other party's messages appear the instant they are stored — no
 *     refetch, no polling (fallback: query invalidation still refreshes);
 *   - a typing indicator relays while the other side is composing;
 *   - a presence line shows whether the other party is online right now
 *     (demo-scoped presence — see mini-services/notify).
 */

const QUICK_REPLIES: Record<"customer" | "worker", string[]> = {
  customer: ["Please call when you arrive", "The gate code is 1947#", "Thank you!"],
  worker: ["I'm at the gate", "Running 10 minutes late", "Work done — please check"],
};

/** Statuses where the thread is still open for conversation. */
const CHAT_OPEN = ["pending_acceptance", "confirmed", "en_route", "arrived", "in_progress", "awaiting_confirmation"];

export function BookingChat({
  booking,
  viewerRole,
  otherName,
  className,
}: {
  booking: Booking;
  viewerRole: "customer" | "worker";
  otherName: string;
  className?: string;
}) {
  const messages = booking.messages ?? [];
  const [text, setText] = useState("");
  const send = useSendMessage();
  const endRef = useRef<HTMLDivElement>(null);
  const open = CHAT_OPEN.includes(booking.status);

  const myUserId = DEMO_USER_ID[viewerRole];
  const otherUserId = viewerRole === "customer" ? booking.workerId : booking.customerId;
  const { incoming, typing, emitTyping } = useLiveChat(booking.id, myUserId);
  const otherOnline = useLiveStore((s) => s.presence[otherUserId] ?? false);

  /* server truth + live appends, deduped by id (the sender's own POST
     response and the chat-room echo carry the same message id) */
  const thread = useMemo(() => {
    const seen = new Set<string>();
    const merged: BookingMessage[] = [];
    for (const m of [...messages, ...incoming]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      merged.push(m);
    }
    return merged;
  }, [messages, incoming]);

  /* keep the latest message in view when the thread updates */
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread.length, typing]);

  const submit = () => {
    const t = text.trim();
    if (!t || send.isPending) return;
    send.mutate({ id: booking.id, text: t }, { onSuccess: () => setText("") });
  };

  const firstName = otherName.split(" ")[0];

  return (
    <div className={className}>
      {thread.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3" aria-label="Thread summary">
          <p className="tnum text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
            {thread.length} {thread.length === 1 ? "message" : "messages"}
          </p>
          <ThreadLiveChip />
        </div>
      )}
      {thread.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {open
            ? `No messages yet — say hello, share access details or timings with ${firstName}. Messages stay with this booking.`
            : `This booking had no messages.`}
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Message thread">
          {thread.map((m) => (
            <ChatBubble key={m.id} message={m} own={m.authorRole === viewerRole} />
          ))}
        </ul>
      )}

      {typing && <TypingIndicator name={firstName} />}

      {open && (
        <div className="mt-4 space-y-2.5 border-t border-border/70 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2" aria-live="polite">
            <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  otherOnline ? "bg-success" : "bg-muted-foreground/40",
                )}
                aria-hidden
              />
              <span className="truncate">
                {otherOnline
                  ? `${firstName} is online — messages arrive instantly`
                  : `${firstName} is offline — they will get your message as a notification`}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Quick replies">
            {QUICK_REPLIES[viewerRole].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setText(q)}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                emitTyping();
              }}
              placeholder={`Message ${firstName}…`}
              aria-label={`Message ${otherName}`}
              maxLength={500}
              className="h-9 text-[13px]"
            />
            <Button type="submit" size="sm" className="h-9 shrink-0" disabled={!text.trim() || send.isPending} aria-label="Send message">
              <Send className="h-3.5 w-3.5" strokeWidth={1.9} />
              Send
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground">
            Visible to you, {firstName} and the cooperative's support desk if a dispute is raised.
          </p>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Real-time layer                                                      */
/* ------------------------------------------------------------------ */

/**
 * Joins this booking's chat room on the shared socket and exposes:
 *   - `incoming`   — messages pushed live from the other party (deduped
 *                    upstream by id against the query data)
 *   - `typing`     — true while the other party was typing recently
 *   - `emitTyping` — throttled relay of THIS side's typing activity
 *
 * Also registers the booking as this tab's open chat (used to suppress the
 * duplicate toast when a message lands in the visible thread).
 */
function useLiveChat(bookingId: string, myUserId: string) {
  const [incoming, setIncoming] = useState<BookingMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getLiveSocket();
    socket.emit("join-chat", { bookingId });
    useLiveStore.getState().setOpenChatBookingId(bookingId);

    const onMessage = (p: { bookingId?: string; message?: BookingMessage }) => {
      if (p?.bookingId !== bookingId || !p.message?.id) return;
      setIncoming((prev) => (prev.some((m) => m.id === p.message!.id) ? prev : [...prev, p.message!]));
      /* the message landed — the other side stopped typing */
      if (typingTimer.current) clearTimeout(typingTimer.current);
      setTyping(false);
      /* server truth for the surrounding screen (timeline, counts) */
      void qc.invalidateQueries({ queryKey: ["booking", bookingId] });
    };
    socket.on("chat:message", onMessage);

    const onTyping = (p: { bookingId?: string; from?: string | null }) => {
      if (p?.bookingId !== bookingId || !p.from || p.from === myUserId) return;
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 3_500);
    };
    socket.on("chat:typing", onTyping);

    return () => {
      socket.emit("leave-chat", { bookingId });
      socket.off("chat:message", onMessage);
      socket.off("chat:typing", onTyping);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (useLiveStore.getState().openChatBookingId === bookingId) {
        useLiveStore.getState().setOpenChatBookingId(null);
      }
    };
  }, [bookingId, myUserId, qc]);

  const emitTyping = useCallback(() => {
    const socket = getLiveSocket();
    if (!socket.connected) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 1_500) return;
    lastTypingSent.current = now;
    socket.emit("chat:typing", { bookingId });
  }, [bookingId]);

  return { incoming, typing, emitTyping };
}

/* ------------------------------------------------------------------ */
/* Presentation                                                         */
/* ------------------------------------------------------------------ */

function ChatBubble({ message, own }: { message: BookingMessage; own: boolean }) {
  return (
    <li className={cn("flex gap-2.5", own ? "flex-row-reverse" : "flex-row")}>
      <span
        className={cn(
          "mt-0.5 h-2 w-2 shrink-0 self-center rounded-full",
          message.authorRole === "worker" ? "bg-chart-2" : "bg-warning/60",
        )}
        aria-hidden
      />
      <div className={cn("min-w-0 max-w-[85%] sm:max-w-[75%]")}>
        <div
          className={cn(
            "rounded-lg border px-3.5 py-2.5",
            own ? "rounded-tr-sm border-primary/25 bg-primary-muted" : "rounded-tl-sm bg-muted/40",
          )}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            {message.authorName}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed">{message.text}</p>
        </div>
        <p className={cn("mt-1 text-[10.5px] text-muted-foreground", own ? "text-right" : "text-left")}>
          {relativeTime(message.at)}
        </p>
      </div>
    </li>
  );
}

/** "{name} is typing" with three staggered dots (reduced-motion safe). */
function TypingIndicator({ name }: { name: string }) {
  return (
    <p
      className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"
      aria-live="polite"
      aria-label={`${name} is typing`}
    >
      <span className="flex items-center gap-0.5 rounded-full border bg-muted/40 px-2.5 py-1.5" aria-hidden>
        <span className="typing-dot h-1 w-1 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-1 w-1 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-1 w-1 rounded-full bg-muted-foreground" />
      </span>
      {name} is typing…
    </p>
  );
}

/**
 * Tiny "this thread is live" chip beside the message count — shown only
 * while the real-time channel is connected (the header pill covers the
 * delayed state globally, so the chip stays silent there).
 */
function ThreadLiveChip() {
  const connected = useLiveStore((s) => s.connected);
  if (!connected) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success-muted/50 px-2 py-0.5"
      title="Messages in this thread arrive instantly over the live channel."
    >
      <span className="h-1 w-1 rounded-full bg-success" aria-hidden />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-success-deep">Live</span>
    </span>
  );
}
