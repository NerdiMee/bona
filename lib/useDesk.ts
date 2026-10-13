"use client";
import { useEffect, useRef, useState } from "react";
import { createSignal } from "./signal";
import { CandidateQueue, describeIce, gathered, readStats, rtcConfig, type Stats } from "./rtc";
import { defaultCrop, type Crop, type CtlMsg } from "./crop";

export type Phase = "idle" | "waiting" | "connecting" | "live" | "lost";

/* The desk side of a room: waits for the phone's offer, answers, and exposes the stream, crop and live stats. */
export function useDesk(room: string | null) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [crop, setCrop] = useState<Crop>(defaultCrop());
  const [label, setLabel] = useState("");
  const [stats, setStats] = useState<Stats>({ fps: 0, kbps: 0, rtt: 0, w: 0, h: 0 });
  const [history, setHistory] = useState<number[]>([]);
  const [diag, setDiag] = useState("");
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!room) return;
    const sig = createSignal(room, "desk");
    let queue: CandidateQueue | null = null;
    let prev = { bytes: 0, t: performance.now() };
    const teardown = () => { pcRef.current?.close(); pcRef.current = null; queue = null; setStream(null); setStats({ fps: 0, kbps: 0, rtt: 0, w: 0, h: 0 }); };
    sig.onOpen = () => setPhase((p) => (p === "idle" ? "waiting" : p));
    sig.onDown = () => setPhase((p) => (p === "live" ? p : "waiting"));
    sig.on(async (m) => {
      if (m.t === "joined") setPhase(m.peers.phone ? "connecting" : "waiting");
      if (m.t === "peer" && m.role === "phone") { if (m.present) setPhase("connecting"); else { teardown(); setPhase("waiting"); } }
      if (m.t === "replaced") { sig.close(); teardown(); setPhase("lost"); }
      if (m.t !== "signal") return;
      const p = m.payload as RTCSessionDescriptionInit & { candidate?: RTCIceCandidateInit };
      if (p.type === "offer") {
        teardown();
        const pc = new RTCPeerConnection(rtcConfig); pcRef.current = pc; queue = new CandidateQueue(pc);
        const ms = new MediaStream();
        pc.ontrack = (e) => { ms.addTrack(e.track); setStream(new MediaStream(ms.getTracks())); };
        pc.ondatachannel = (e) => { e.channel.onmessage = (ev) => { try { const c = JSON.parse(ev.data) as CtlMsg; if (c.t === "crop") setCrop(c.crop); if (c.t === "hello") setLabel(c.label); } catch { /* ignore */ } }; };
        pc.onconnectionstatechange = () => { const s = pc.connectionState; if (s === "connected") setPhase("live"); else if (s === "failed") { setPhase("lost"); if (pcRef.current === pc) teardown(); } else if (s === "disconnected") setTimeout(() => { if (pcRef.current === pc && pc.connectionState === "disconnected") setPhase("lost"); }, 5000); };
        pc.oniceconnectionstatechange = () => { describeIce(pc).then(setDiag).catch(() => {}); };
        await pc.setRemoteDescription(p); await queue.flush();
        const ans = await pc.createAnswer(); await pc.setLocalDescription(ans); sig.signal(await gathered(pc));
      } else if (p.candidate && queue) { await queue.push(p.candidate); }
    });
    /* Connect one tick later so a mount that is immediately unmounted again (React dev) never opens a relay seat. */
    let alive = true; const start = setTimeout(() => { if (alive) sig.connect(); }, 60);
    const iv = setInterval(async () => {
      const pc = pcRef.current; if (!pc) return;
      if (pc.connectionState !== "connected") { describeIce(pc).then(setDiag).catch(() => {}); return; }
      const r = await readStats(pc, prev); prev = r.prev; setStats(r.stats); setHistory((h) => [...h.slice(-59), r.stats.kbps]);
    }, 1000);
    return () => { alive = false; clearTimeout(start); clearInterval(iv); teardown(); sig.close(); };
  }, [room]);

  return { phase, stream, crop, label, stats, history, diag };
}
