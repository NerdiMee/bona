/* Bona Phone Camera · background. The only part that talks to Bona, from the extension's own origin, and only
 * for sites the user has allowed from the popup. Hosted Bona: the handshake goes through Supabase Realtime
 * (room remembered from the Bona page). Offline Bona: the loopback bridge on this computer. */
try { importScripts("vendor/supabase.js", "config.js"); } catch { /* Firefox loads them from the manifest */ }
const BRIDGE = "http://127.0.0.1:4601";
const originOf = (sender) => { if (sender.origin) return sender.origin; try { return new URL(sender.url).origin; } catch { return ""; } };
const isAllowed = async (origin) => { const { allowed = [] } = await chrome.storage.local.get("allowed"); return !!origin && allowed.includes(origin); };
const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");

/* A desk seat in a hosted room, speaking the same frames the page expects: joined, peer, signal.
 * Broadcast only: hellos every 2 s mark who is present; a bye or 6.5 s of silence marks who left. */
function hostedDesk(room, onFrame, onClosed) {
  const client = supabase.createClient(BONA_SUPABASE_URL, BONA_SUPABASE_KEY);
  const id = rnd(), at = Date.now(); const known = new Map(); let announced = false, timers = [];
  const ch = client.channel(`bona:${room}`, { config: { broadcast: { self: false, ack: false } } });
  const send = (event, payload) => ch.send({ type: "broadcast", event, payload }).catch(() => {});
  const hello = () => send("hello", { role: "desk", id, at });
  const gone = (k) => { const v = known.get(k); if (!v) return; known.delete(k); onFrame({ t: "peer", role: v.role, present: false, id: k }); };
  ch.on("broadcast", { event: "hello" }, ({ payload: p }) => { if (!p || typeof p.id !== "string" || p.id === id || (p.role !== "phone" && p.role !== "desk")) return; const fresh = !known.has(p.id); known.set(p.id, { role: p.role, last: Date.now() }); if (fresh && announced) onFrame({ t: "peer", role: p.role, present: true, id: p.id }); });
  ch.on("broadcast", { event: "bye" }, ({ payload: p }) => { if (p && typeof p.id === "string") gone(p.id); });
  ch.on("broadcast", { event: "signal" }, ({ payload: m }) => { if (m && m.from === "phone" && m.to === id) onFrame({ t: "signal", from: "phone", payload: m.payload }); });
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") { hello(); timers = [setInterval(hello, 2000), setInterval(() => { const now = Date.now(); for (const [k, v] of known) if (now - v.last > 6500) gone(k); }, 1000)]; setTimeout(() => { announced = true; onFrame({ t: "joined", id, peers: { phone: [...known.values()].some((v) => v.role === "phone"), desks: [...known].filter(([, v]) => v.role === "desk").map(([k]) => k) } }); }, 1200); }
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") onClosed();
  });
  return { send: (payload) => send("signal", { from: "desk", id, payload }), close: () => { timers.forEach(clearInterval); send("bye", { id }); setTimeout(() => client.removeChannel(ch).catch(() => {}), 200); } };
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "bona") return;
  const origin = originOf(port.sender || {}); let ws = null, seat = null;
  const reply = (id, ok, data, error) => { try { port.postMessage({ res: id, ok, data, error }); } catch { /* port gone */ } };
  const frame = (f) => { try { port.postMessage({ ws: JSON.stringify(f) }); } catch { /* ignore */ } };
  const closed = () => { try { port.postMessage({ wsClosed: true }); } catch { /* ignore */ } };
  port.onMessage.addListener(async (m) => {
    if (!m || typeof m !== "object") return;
    if (m.type === "allowed") return reply(m.id, true, await isAllowed(origin));
    if (!(await isAllowed(origin))) return reply(m.id, false, null, "Bona is not allowed on this site. Click the Bona button in the toolbar to allow it.");
    const { room, roomAt = 0, hosted = false } = await chrome.storage.local.get(["room", "roomAt", "hosted"]);
    const useHosted = hosted && room && Date.now() - roomAt < 12 * 3600 * 1000;
    if (m.type === "rooms") {
      if (useHosted) return reply(m.id, true, { rooms: [{ code: room }], hosted: true });
      try { const r = await fetch(BRIDGE + "/rooms", { cache: "no-store" }); reply(m.id, true, await r.json()); } catch { reply(m.id, false, null, room ? "Bona's handshake is unavailable. Open the Bona page again." : "Open Bona in a tab first so the extension knows your room."); }
      return;
    }
    if (m.type === "ws-open") {
      try { ws?.close(); seat?.close(); } catch { /* ignore */ } ws = null; seat = null;
      if (useHosted) { try { seat = hostedDesk(room, frame, closed); reply(m.id, true); } catch { reply(m.id, false, null, "Bona's handshake is unavailable."); } return; }
      ws = new WebSocket(BRIDGE.replace("http", "ws") + "/ws");
      ws.onopen = () => reply(m.id, true); ws.onmessage = (e) => { try { port.postMessage({ ws: e.data }); } catch { /* ignore */ } }; ws.onclose = closed;
      ws.onerror = () => reply(m.id, false, null, "Bona is not running on this computer.");
      return;
    }
    if (m.type === "ws-send") {
      if (typeof m.data !== "string") return;
      if (seat) { let f; try { f = JSON.parse(m.data); } catch { return; } if (f && f.t === "signal") seat.send(f.payload); return; }
      if (ws && ws.readyState === 1) ws.send(m.data); return;
    }
    if (m.type === "ws-close") { try { ws?.close(); seat?.close(); } catch { /* ignore */ } ws = null; seat = null; return; }
    if (m.type === "ping") return reply(m.id, true);
  });
  port.onDisconnect.addListener(() => { try { ws?.close(); seat?.close(); } catch { /* ignore */ } });
});
