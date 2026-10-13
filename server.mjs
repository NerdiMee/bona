// Bona: HTTPS Next server + WebSocket signalling for phone <-> desk WebRTC.
// HTTPS is required because phones only expose the camera to secure pages.
import { createServer } from "node:https";
import { createServer as createHttp } from "node:http";
import { networkInterfaces } from "node:os";
import { randomBytes } from "node:crypto";
import next from "next";
import { WebSocketServer } from "ws";
import { ensureCerts } from "./lib/certs.mjs";

const port = parseInt(process.env.PORT || "4600", 10);
const dev = process.env.NODE_ENV !== "production";

export const lanAddresses = () =>
  Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address);

const { key, cert } = await ensureCerts(lanAddresses());
const app = next({ dev, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();
await app.prepare();
const upgrade = app.getUpgradeHandler();

const server = createServer({ key, cert }, (req, res) => handle(req, res));
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
const MAX_DESKS = 8;

/* Rooms: one phone and any number of desks (the Bona page, the clean OBS window) per code.
 * Messages are relayed, never stored. The phone addresses each desk by the id the server gave it. */
const rooms = new Map();
const send = (ws, obj) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const validRoom = (r) => typeof r === "string" && /^[a-z0-9]{6,12}$/i.test(r);
const getRoom = (code) => { let r = rooms.get(code); if (!r) { r = { phone: null, desks: new Map() }; rooms.set(code, r); } return r; };

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("message", (raw) => {
    let m; try { m = JSON.parse(String(raw)); } catch { return; }
    if (!m || typeof m !== "object") return;
    if (m.t === "join" && !ws.room && validRoom(m.room) && (m.role === "phone" || m.role === "desk")) {
      const room = getRoom(m.room);
      if (m.role === "desk" && room.desks.size >= MAX_DESKS) { send(ws, { t: "replaced" }); ws.close(); return; }
      ws.room = m.room; ws.role = m.role;
      if (m.role === "phone") {
        if (room.phone && room.phone !== ws) { send(room.phone, { t: "replaced" }); room.phone.close(); }
        room.phone = ws;
        send(ws, { t: "joined", peers: { phone: true, desks: [...room.desks.keys()] } });
        for (const d of room.desks.values()) send(d, { t: "peer", role: "phone", present: true });
        console.log(`[room ${m.room}] phone joined (${room.desks.size} desk${room.desks.size === 1 ? "" : "s"} waiting)`);
      } else {
        ws.id = randomBytes(4).toString("hex"); room.desks.set(ws.id, ws);
        send(ws, { t: "joined", id: ws.id, peers: { phone: !!room.phone, desks: [...room.desks.keys()] } });
        send(room.phone, { t: "peer", role: "desk", present: true, id: ws.id });
        console.log(`[room ${m.room}] desk ${ws.id} joined (phone ${room.phone ? "present" : "absent"})`);
      }
      return;
    }
    if (m.t === "signal" && ws.room) {
      const room = rooms.get(ws.room); if (!room) return;
      if (ws.role === "desk") send(room.phone, { t: "signal", from: "desk", id: ws.id, payload: m.payload });
      else send(room.desks.get(m.to), { t: "signal", from: "phone", payload: m.payload });
    }
  });
  ws.on("close", () => {
    if (!ws.room) return;
    const room = rooms.get(ws.room); if (!room) return;
    console.log(`[room ${ws.room}] ${ws.role}${ws.id ? " " + ws.id : ""} left`);
    if (ws.role === "phone" && room.phone === ws) { room.phone = null; for (const d of room.desks.values()) send(d, { t: "peer", role: "phone", present: false }); }
    if (ws.role === "desk" && room.desks.get(ws.id) === ws) { room.desks.delete(ws.id); send(room.phone, { t: "peer", role: "desk", present: false, id: ws.id }); }
    if (!room.phone && !room.desks.size) rooms.delete(ws.room);
  });
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } }, 25000).unref();

server.on("upgrade", (req, socket, head) => {
  if (req.url && req.url.startsWith("/ws") && !originOkMain(req)) { socket.destroy(); return; }
  if (req.url && req.url.startsWith("/ws")) wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  else upgrade(req, socket, head);
});
/* Who may talk to the signalling. Web pages may only reach the HTTPS server from Bona's own origins; the
 * loopback bridge answers the browser extension (its own extension origin) and local tools (no Origin),
 * never a web page. Host is pinned too, against DNS rebinding. */
const isExtension = (o) => /^(chrome|moz|safari-web)-extension:\/\//.test(o);
const ownOrigin = (o) => { try { const u = new URL(o); return u.port === String(port) && (u.hostname === "localhost" || u.hostname === "127.0.0.1" || lanAddresses().includes(u.hostname)); } catch { return false; } };
const originOkMain = (req) => { const o = req.headers.origin; return !o || isExtension(o) || ownOrigin(o); };
const originOkBridge = (req) => { const o = req.headers.origin, h = req.headers.host; return (h === `127.0.0.1:${port + 1}` || h === `localhost:${port + 1}`) && (!o || isExtension(o)); };

/* Plain HTTP on the loopback only, for the Bona browser extension's background script:
 * /rooms tells it which room has a phone, /ws is the same signalling without a certificate. */
const local = createHttp((req, res) => {
  if (!originOkBridge(req)) { res.writeHead(403); res.end(); return; }
  if (req.url === "/rooms") {
    const list = [...rooms.entries()].filter(([, r]) => r.phone).map(([code, r]) => ({ code, desks: r.desks.size }));
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ rooms: list, port }));
    return;
  }
  res.writeHead(404); res.end();
});
local.on("upgrade", (req, socket, head) => { if (originOkBridge(req) && req.url && req.url.startsWith("/ws")) wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req)); else socket.destroy(); });
local.listen(port + 1, "127.0.0.1");

server.listen(port, "0.0.0.0", () => {
  console.log(`Bona on https://localhost:${port}  (LAN: ${lanAddresses().map((ip) => `https://${ip}:${port}`).join("  ")})  extension bridge http://127.0.0.1:${port + 1}`);
});
