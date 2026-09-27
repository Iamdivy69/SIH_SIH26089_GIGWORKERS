/**
 * Sahyog — real-time notification push service (mini-service).
 *
 * Purpose: pushes newly-created notifications to connected browser tabs the
 * instant the mock API records them, instead of waiting for the frontend's
 * 20s polling fallback. The Next.js mock API (src/server/db.ts `notify()`)
 * POSTs every new notification to the CONTROL port (127.0.0.1:3031); the
 * service emits it to the room named after the target user id.
 *
 * Ports (this service owns two):
 *   3030 — browser-facing websocket (socket.io, engine.io path MUST stay "/"
 *          because browsers connect through the Caddy gateway as
 *          io("/?XTransformPort=3030") — engine.io then owns every request
 *          on that port, so nothing else can be served there).
 *   3031 — internal loopback-only control HTTP (POST /publish, GET /health),
 *          used exclusively server-to-server by the Next.js mock API.
 *
 * Failure semantics: this service is best-effort. If it is down, the POST
 * /publish calls fail silently server-side and the app keeps working on
 * polling alone — nothing else depends on it.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { Server } from "socket.io";

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
  };
}

/* ------------------------------------------------------------------ */
/* Socket layer — one room per user id                                 */
/* ------------------------------------------------------------------ */

const io = new Server({
  /** Gateway contract: browsers connect as io("/?XTransformPort=3030"), so the
      engine.io path must stay "/" — Caddy forwards on exactly this shape. */
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingInterval: 25_000,
  pingTimeout: 60_000,
});

function roomSummary(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [room, sockets] of io.sockets.adapter.rooms) {
    /* every socket implicitly joins a room named by its own id — skip those */
    if (room.length > 20 || io.sockets.sockets.has(room)) continue;
    out[room] = sockets.size;
  }
  return out;
}

io.on("connection", (socket) => {
  /* demo-scoped: each tab subscribes to exactly one demo user id and may
     switch rooms when the demo role changes */
  socket.data.userId = null as string | null;

  socket.on("subscribe", (payload: unknown) => {
    const userId =
      typeof (payload as { userId?: unknown })?.userId === "string"
        ? (payload as { userId: string }).userId.trim()
        : "";
    if (!userId) return;
    const previous = socket.data.userId as string | null;
    if (previous && previous !== userId) socket.leave(previous);
    socket.data.userId = userId;
    socket.join(userId);
    socket.emit("subscribed", { userId });
  });

  socket.on("disconnect", () => {
    socket.data.userId = null;
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
