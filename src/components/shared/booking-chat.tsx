"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSendMessage } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import type { Booking, BookingMessage } from "@/lib/types";

/**
 * BookingChat — the shared customer↔worker message thread.
 * One component serves both sides: alignment is driven by `viewerRole`.
 * Messages live on the booking, so the thread is scoped to a single service
 * and stays part of its auditable record.
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

  /* keep the latest message in view when the thread updates */
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const submit = () => {
    const t = text.trim();
    if (!t || send.isPending) return;
    send.mutate({ id: booking.id, text: t }, { onSuccess: () => setText("") });
  };

  return (
    <div className={className}>
      {messages.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {open
            ? `No messages yet — say hello, share access details or timings with ${otherName.split(" ")[0]}. Messages stay with this booking.`
            : `This booking had no messages.`}
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Message thread">
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} own={m.authorRole === viewerRole} />
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-4 space-y-2.5 border-t border-border/70 pt-4">
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
              onChange={(e) => setText(e.target.value)}
              placeholder={`Message ${otherName.split(" ")[0]}…`}
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
            Visible to you, {otherName.split(" ")[0]} and the cooperative's support desk if a dispute is raised.
          </p>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

function ChatBubble({ message, own }: { message: BookingMessage; own: boolean }) {
  return (
    <li className={cn("flex gap-2.5", own ? "flex-row-reverse" : "flex-row")}>
      <span
        className={cn(
          "mt-0.5 h-2 w-2 shrink-0 self-center rounded-full",
          message.authorRole === "worker" ? "bg-[oklch(0.62_0.088_158)]" : "bg-[oklch(0.75_0.045_75)]",
        )}
        aria-hidden
      />
      <div className={cn("min-w-0 max-w-[85%] sm:max-w-[75%]")}>
        <div
          className={cn(
            "rounded-lg border px-3.5 py-2.5",
            own ? "rounded-tr-sm border-primary/25 bg-[oklch(0.965_0.016_155)]" : "rounded-tl-sm bg-muted/40",
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
