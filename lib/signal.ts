// Thin WebSocket client for the signalling room. Reconnects on its own.
export type Role = "phone" | "desk";
export type SignalMsg =
  | { t: "joined"; id?: string; peers: { phone: boolean; desks: string[] } }
  | { t: "peer"; role: Role; present: boolean; id?: string }
  | { t: "signal"; from: Role; id?: string; payload: unknown }
  | { t: "replaced" };

type Handler = (m: SignalMsg) => void;

export class Signal implements Transport {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private closed = false;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  readonly room: string;
  readonly role: Role;
  onOpen: (() => void) | null = null;
  onDown: (() => void) | null = null;

  constructor(room: string, role: Role) { this.room = room; this.role = role; }

  connect() {
    if (this.closed) return;
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
    const ws = new WebSocket(url); this.ws = ws;
    ws.onopen = () => { this.attempt = 0; ws.send(JSON.stringify({ t: "join", room: this.room, role: this.role })); this.onOpen?.(); };
    ws.onmessage = (e) => { try { const m = JSON.parse(e.data) as SignalMsg; this.handlers.forEach((h) => h(m)); } catch { /* ignore */ } };
    ws.onclose = () => { this.ws = null; this.onDown?.(); if (!this.closed) { this.attempt++; this.timer = setTimeout(() => this.connect(), Math.min(5000, 800 * this.attempt)); } };
    ws.onerror = () => ws.close();
  }
  on(h: Handler) { this.handlers.add(h); return () => this.handlers.delete(h); }
  signal(payload: unknown, to?: string) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ t: "signal", payload, to })); }
  get open() { return this.ws?.readyState === 1; }
  close() { this.closed = true; if (this.timer) clearTimeout(this.timer); this.ws?.close(); this.ws = null; }
}

export const roomCode = (len = 8) => {
  const a = "abcdefghjkmnpqrstuvwxyz23456789"; const v = new Uint8Array(len); crypto.getRandomValues(v);
  return Array.from(v, (b) => a[b % a.length]).join("");
};

/* ---------- Hosted transport: Supabase Realtime carries only the handshake ----------
 * Broadcast only (the service's presence tracker times out on this project): every seat sends a small
 * hello every 2 s and a bye on leaving; a peer is present while its hellos keep arriving. Offer, answer and
 * candidates travel the same channel. The media never touches the relay: WebRTC, peer to peer on the LAN. */
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

export interface Transport {
  readonly room: string; readonly role: Role;
  onOpen: (() => void) | null; onDown: (() => void) | null;
  connect(): void; on(h: Handler): () => void; signal(payload: unknown, to?: string): void; close(): void;
}
type Seen = { role: Role; at: number; last: number };
const HELLO_MS = 2000, GONE_MS = 6500, SETTLE_MS = 1200;

export class SupaSignal implements Transport {
  private client: SupabaseClient;
  private ch: RealtimeChannel | null = null;
  private handlers = new Set<Handler>();
  private known = new Map<string, Seen>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private announced = false;
  private closed = false;
  readonly id = roomCode(8);
  readonly joinedAt = Date.now();
  readonly room: string; readonly role: Role;
  onOpen: (() => void) | null = null;
  onDown: (() => void) | null = null;
  constructor(room: string, role: Role, url: string, key: string) { this.room = room; this.role = role; this.client = createClient(url, key); }
  private emit(m: SignalMsg) { this.handlers.forEach((h) => h(m)); }
  private send(event: string, payload: unknown) { this.ch?.send({ type: "broadcast", event, payload }).catch(() => {}); }
  private hello() { this.send("hello", { role: this.role, id: this.id, at: this.joinedAt }); }
  private seen(p: { role?: Role; id?: string; at?: number }) {
    if (!p || typeof p.id !== "string" || p.id === this.id || (p.role !== "phone" && p.role !== "desk") || typeof p.at !== "number") return;
    const fresh = !this.known.has(p.id);
    this.known.set(p.id, { role: p.role, at: p.at, last: Date.now() });
    if (fresh && this.role === "phone" && p.role === "phone" && p.at > this.joinedAt) { this.emit({ t: "replaced" }); this.close(); return; }
    if (fresh && this.announced) { this.emit({ t: "peer", role: p.role, present: true, id: p.id }); if (p.role === "desk") this.hello(); }
  }
  private gone(id: string) { const k = this.known.get(id); if (!k) return; this.known.delete(id); this.emit({ t: "peer", role: k.role, present: false, id }); }
  private expire() { const now = Date.now(); for (const [id, k] of this.known) if (now - k.last > GONE_MS) this.gone(id); }
  private announce() { if (this.announced) return; this.announced = true; this.emit({ t: "joined", id: this.id, peers: { phone: [...this.known.values()].some((k) => k.role === "phone"), desks: [...this.known].filter(([, k]) => k.role === "desk").map(([id]) => id) } }); }
  connect() {
    if (this.closed) return;
    const ch = this.client.channel(`bona:${this.room}`, { config: { broadcast: { self: false, ack: false } } }); this.ch = ch;
    ch.on("broadcast", { event: "hello" }, ({ payload }) => this.seen(payload as { role?: Role; id?: string; at?: number }));
    ch.on("broadcast", { event: "bye" }, ({ payload }) => { const p = payload as { id?: string }; if (p && typeof p.id === "string") this.gone(p.id); });
    ch.on("broadcast", { event: "signal" }, ({ payload }) => {
      const m = payload as { from: Role; id: string; to?: string; payload: unknown };
      if (!m || typeof m !== "object") return;
      if (this.role === "desk" && (m.from !== "phone" || m.to !== this.id)) return;
      if (this.role === "phone" && m.from !== "desk") return;
      this.emit({ t: "signal", from: m.from, id: m.id, payload: m.payload });
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        this.hello();
        this.timers.forEach(clearInterval); this.timers = [setInterval(() => this.hello(), HELLO_MS), setInterval(() => this.expire(), 1000)];
        setTimeout(() => this.announce(), SETTLE_MS);
        this.onOpen?.();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") this.onDown?.();
    });
  }
  on(h: Handler) { this.handlers.add(h); return () => this.handlers.delete(h); }
  signal(payload: unknown, to?: string) { this.send("signal", { from: this.role, id: this.id, to, payload }); }
  close() {
    if (this.closed) return; this.closed = true;
    this.timers.forEach(clearInterval); this.timers = [];
    const ch = this.ch; this.ch = null;
    if (ch) { ch.send({ type: "broadcast", event: "bye", payload: { id: this.id } }).catch(() => {}).finally(() => { this.client.removeChannel(ch).catch(() => {}); }); }
  }
}

export const hosted = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_KEY);
export function createSignal(room: string, role: Role): Transport {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_KEY;
  if (url && key) return new SupaSignal(room, role, url, key);
  return new Signal(room, role);
}
