/**
 * Sahyog — real-time push service (mini-service).
 *
 * Purpose: pushes newly-created notifications to connected browser tabs the
 * instant the mock API records them, instead of waiting for the frontend's
 * 20s polling fallback — and carries the live booking chat (instant message
 * delivery, typing indicator, online presence) between customer and worker
 * tabs.
 *
 * The Next.js mock API (src/server/db.ts `notify()` / `addBookingMessage()`)
 * POSTs every event to the CONTROL port (127.0.0.1:3031); the service fans
 * it out to the right room:
 *
 *   user room `c-ananya`            → notifications (one room per demo user)
 *   chat room `chat:bk-103`         → live chat messages for that booking
 *   broadcast `presence`            → who is online right now
 *
 * Ports (this service owns two):
 *   3030 — browser-facing websocket (socket.io, engine.io path MUST stay "/"
 *          because browsers connect through the Caddy gateway as
 *          io("/?XTransformPort=3030") — engine.io then owns every request
 *          on that port, so nothing else can be served there).
 *   3031 — internal loopback-only control HTTP (POST /publish, POST /chat,
 *          GET /health), used exclusively server-to-server by the Next.js
 *          mock API.
 *
 * Failure semantics: this service is best-effort. If it is down, the POSTs
 * fail silently server-side and the app keeps working on polling alone —
 * nothing else depends on it.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { Server, type Socket } from "socket.io";

const SOCKET_PORT = 3030;
const CONTROL_PORT = 3031;

/** Shape published by the Next.js mock API (subset of AppNotification). */
interface PushPayload {
  userId: string;
  notification: {
    id: string;
    kind: string;
    title: string;
    body: string;
    createdAt: string;
    route?: { name: string; params?: Record<string, string> };
  };
}

/** Live chat payload published by the mock API after a message is stored. */
interface ChatPayload {
  bookingId: string;
  message: {
    id: string;
    authorRole: string;
    authorName: string;
    text: string;
    at: string;
  };
}

/** Room ids are `chat:<bookingId>`; booking ids look like `bk-103`. */
const BOOKING_ID_RE = /^bk-[a-z0-9-]{1,24}$/i;
const chatRoom = (bookingId: string) => `chat:${bookingId}`;

/* ------------------------------------------------------------------ */
/* Socket layer — user rooms + chat rooms + presence                   */
/* ------------------------------------------------------------------ */

const io = new Server({
  /** Gateway contract: browsers connect as io("/?XTransformPort=3030"), so the
      engine.io path must stay "/" — Caddy forwards on exactly this shape. */
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingInterval: 25_000,
  pingTimeout: 60_000,
});

/**
 * Presence: userId → sockets currently subscribed as that user. A user is
 * "online" while the set is non-empty (multiple tabs = multiple sockets).
 * Demo-scoped: presence is broadcast to every connected socket because the
 * prototype has exactly three trusted demo users; a production deployment
 * would scope it to users who share an active booking.
 */
const onlineUsers = new Map<string, Set<string>>();

function broadcastPresence(userId: string, online: boolean) {
  io.emit("presence", { userId, online });
}

function roomSummary(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [room, sockets] of io.sockets.adapter.rooms) {
    /* every socket implicitly joins a room named by its own id — skip those */
    if (room.length > 20 || io.sockets.sockets.has(room)) continue;
    out[room] = sockets.size;
  }
  return out;
}

io.on("connection", (socket: Socket) => {
  /* demo-scoped: each tab subscribes to exactly one demo user id and may
     switch rooms when the demo role changes */
  socket.data.userId = null as string | null;

  socket.on("subscribe", (payload: unknown) => {
    const userId =
      typeof (payload as { userId?: unknown })?.userId === "string"
        ? (payload as { userId: string }).userId.trim()
        : "";
    if (!userId || userId.length > 40) return;
    const previous = socket.data.userId as string | null;
    if (previous && previous !== userId) {
      socket.leave(previous);
      /* drop this socket from the PREVIOUS user's online set — otherwise a
         role switch leaves a phantom "online" entry that never clears */
      const prevSet = onlineUsers.get(previous);
      if (prevSet) {
        prevSet.delete(socket.id);
        if (prevSet.size === 0) {
          onlineUsers.delete(previous);
          broadcastPresence(previous, false);
        }
      }
    }
    socket.data.userId = userId;
    socket.join(userId);

    /* presence bookkeeping — count sockets per user, announce changes once */
    const wasOnline = onlineUsers.has(userId);
    const set = onlineUsers.get(userId) ?? new Set<string>();
    set.add(socket.id);
    onlineUsers.set(userId, set);
    if (!wasOnline) broadcastPresence(userId, true);

    /* the newly-subscribed tab gets the current online set (minus itself —
       it knows it is online; the map includes it for consistency anyway) */
    socket.emit("subscribed", { userId, online: [...onlineUsers.keys()] });
  });

  /* --- live chat rooms --- */

  socket.on("join-chat", (payload: unknown) => {
    const bookingId =
      typeof (payload as { bookingId?: unknown })?.bookingId === "string"
        ? (payload as { bookingId: string }).bookingId.trim()
        : "";
    if (!BOOKING_ID_RE.test(bookingId)) return;
    socket.join(chatRoom(bookingId));
  });

  socket.on("leave-chat", (payload: unknown) => {
    const bookingId =
      typeof (payload as { bookingId?: unknown })?.bookingId === "string"
        ? (payload as { bookingId: string }).bookingId.trim()
        : "";
    if (!BOOKING_ID_RE.test(bookingId)) return;
    socket.leave(chatRoom(bookingId));
  });

  /** Typing indicator: relayed to the other tab(s) in the same chat room. */
  socket.on("chat:typing", (payload: unknown) => {
    const bookingId =
      typeof (payload as { bookingId?: unknown })?.bookingId === "string"
        ? (payload as { bookingId: string }).bookingId.trim()
        : "";
    if (!BOOKING_ID_RE.test(bookingId)) return;
    socket.to(chatRoom(bookingId)).emit("chat:typing", {
      bookingId,
      from: socket.data.userId,
    });
  });

  socket.on("disconnect", () => {
    const userId = socket.data.userId as string | null;
    socket.data.userId = null;
    if (!userId) return;
    const set = onlineUsers.get(userId);
    if (!set) return;
    set.delete(socket.id);
    if (set.size === 0) {
      onlineUsers.delete(userId);
      broadcastPresence(userId, false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Control HTTP (loopback only)                                        */
/* ------------------------------------------------------------------ */

function json(res: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleControl(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${CONTROL_PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, {
      ok: true,
      service: "sahyog-notify",
      clients: io.engine.clientsCount,
      rooms: roomSummary(),
      online: [...onlineUsers.keys()],
      uptimeSec: Math.round(process.uptime()),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/publish") {
    try {
      const parsed = JSON.parse(await readBody(req)) as PushPayload;
      if (
        !parsed ||
        typeof parsed.userId !== "string" ||
        !parsed.notification ||
        typeof parsed.notification.id !== "string" ||
        typeof parsed.notification.title !== "string"
      ) {
        json(res, 400, { ok: false, error: "invalid payload" });
        return;
      }
      const delivered = io.sockets.adapter.rooms.get(parsed.userId)?.size ?? 0;
      io.to(parsed.userId).emit("notification", parsed.notification);
      json(res, 200, { ok: true, delivered });
    } catch (err) {
      json(res, 400, { ok: false, error: err instanceof Error ? err.message : "bad request" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/chat") {
    try {
      const parsed = JSON.parse(await readBody(req)) as ChatPayload;
      if (
        !parsed ||
        typeof parsed.bookingId !== "string" ||
        !BOOKING_ID_RE.test(parsed.bookingId) ||
        !parsed.message ||
        typeof parsed.message.id !== "string" ||
        typeof parsed.message.text !== "string"
      ) {
        json(res, 400, { ok: false, error: "invalid payload" });
        return;
      }
      /* fan out to every tab that currently has this booking's chat open —
         the sender's own tab appends optimistically on its POST response,
         and dedupes by message id if it also receives this event */
      const delivered = io.sockets.adapter.rooms.get(chatRoom(parsed.bookingId))?.size ?? 0;
      io.to(chatRoom(parsed.bookingId)).emit("chat:message", {
        bookingId: parsed.bookingId,
        message: parsed.message,
      });
      json(res, 200, { ok: true, delivered });
    } catch (err) {
      json(res, 400, { ok: false, error: err instanceof Error ? err.message : "bad request" });
    }
    return;
  }

  json(res, 404, { ok: false, error: "not found" });
}

const controlServer = createServer((req, res) => {
  void handleControl(req, res).catch(() => json(res, 500, { ok: false }));
});

/* Socket.io binds its own http server on SOCKET_PORT. */
io.listen(SOCKET_PORT);

/* Control HTTP on the loopback-only internal port. */
controlServer.listen(CONTROL_PORT, "127.0.0.1", () => {
  console.log(`[sahyog-notify] control HTTP on 127.0.0.1:${CONTROL_PORT}`);
});

console.log(`[sahyog-notify] websocket push service listening on :${SOCKET_PORT}`);

/* graceful shutdown */
const shutdown = () => {
  console.log("[sahyog-notify] shutting down");
  controlServer.close();
  io.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
