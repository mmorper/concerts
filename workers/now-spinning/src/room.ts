/**
 * The room: one Durable Object instance ("living-room") holding the current state and the
 * listener's health, and every display's WebSocket.
 *
 * A thin shell around room-logic.ts. It stores exactly two keys ("state", "listener"), broadcasts
 * changes, and keeps one alarm set to the earliest of its deadlines. WebSockets use hibernation, so
 * an idle evening with a display connected costs nothing.
 *
 * Spec: docs/specs/implemented/global-now-spinning/global-now-spinning-spec.md §Behaviour
 */

import { SUBPROTOCOL } from "./auth.js";
import { emptyListener, initialRoom, reduce, type Listener, type RoomEvent, type RoomState } from "./room-logic.js";
import type { NowSpinningState } from "./types.js";

export interface RoomEnv {
  DISPLAY_TZ?: string;
}

export const ONLINE_MS = 15 * 60_000;

/**
 * The heartbeat. Displays send "ping" every 30 s; the runtime answers "pong" itself, without
 * waking the object, so it costs nothing. A display that hears no pong treats its socket as dead
 * and reconnects: a home network can drop an idle connection silently, which would otherwise
 * leave an old song on an OLED screen that is being kept awake.
 */
export const PING = "ping";
export const PONG = "pong";

export class NowSpinningRoom {
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: RoomEnv,
  ) {
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  private tz(): string {
    return this.env.DISPLAY_TZ || "America/Los_Angeles";
  }

  private async load(nowMs: number): Promise<{ room: RoomState; listener: Listener }> {
    const room = (await this.ctx.storage.get<RoomState>("state")) ?? initialRoom(new Date(nowMs).toISOString());
    const listener = (await this.ctx.storage.get<Listener>("listener")) ?? emptyListener();
    return { room, listener };
  }

  private message(room: RoomState, nowMs: number): NowSpinningState {
    return { ...room.state, now: new Date(nowMs).toISOString() };
  }

  private async apply(ev: RoomEvent, nowMs = Date.now()): Promise<NowSpinningState> {
    const { room, listener } = await this.load(nowMs);
    const out = reduce(room, listener, ev, nowMs, this.tz());
    await this.ctx.storage.put({ state: out.room, listener: out.listener });
    if (out.alarmAt) await this.ctx.storage.setAlarm(out.alarmAt);
    else await this.ctx.storage.deleteAlarm();
    const msg = this.message(out.room, nowMs);
    if (out.push) this.broadcast(msg);
    return msg;
  }

  private broadcast(msg: NowSpinningState): void {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        // A socket that's gone away; the runtime tidies it up.
      }
    }
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const nowMs = Date.now();

    if (url.pathname === "/ingest" && req.method === "POST") {
      const ev = (await req.json()) as RoomEvent;
      return json(await this.apply(ev, nowMs));
    }

    if (url.pathname === "/state") {
      const { room } = await this.load(nowMs);
      return json(this.message(room, nowMs));
    }

    if (url.pathname === "/health") {
      const { listener } = await this.load(nowMs);
      const online = !!listener.lastSeenAt && nowMs - Date.parse(listener.lastSeenAt) < ONLINE_MS;
      return json({ online, ...listener });
    }

    if (url.pathname === "/ws" && req.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const { room } = await this.load(nowMs);
      server.send(JSON.stringify(this.message(room, nowMs)));
      const headers: Record<string, string> = {};
      if (url.searchParams.get("subprotocol") === "1") headers["Sec-WebSocket-Protocol"] = SUBPROTOCOL;
      return new Response(null, { status: 101, webSocket: client, headers });
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.apply({ event: "alarm" });
  }

  // Displays only listen. Anything they send is ignored.
  async webSocketMessage(): Promise<void> {}

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
