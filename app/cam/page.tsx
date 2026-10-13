"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Flip, Mic, MicOff, Torch } from "@/components/Icons";
import { createSignal, type Transport } from "@/lib/signal";
import { CandidateQueue, gathered, rtcConfig } from "@/lib/rtc";
import { clampCrop, cropTransform, defaultCrop, MAX_ZOOM, panBy, zoomAbout, type Crop } from "@/lib/crop";
import { GummyBar, GummyLoading } from "@/components/Gummy";

type Phase = "gate" | "starting" | "waiting" | "connecting" | "live" | "lost" | "error";
const words: Record<Phase, string> = { gate: "", starting: "Starting Camera", waiting: "Waiting For The Computer", connecting: "Connecting", live: "Live", lost: "Connection Lost", error: "Camera Blocked" };

/* The phone side: capture, show the live viewport, send it, and let fingers choose the crop. */
function Cam() {
  const room = useSearchParams().get("r");
  const [phase, setPhase] = useState<Phase>("gate");
  const [err, setErr] = useState("");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [muted, setMuted] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [crop, setCrop] = useState<Crop>(defaultCrop());
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [touching, setTouching] = useState(false);
  const [ice, setIce] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sigRef = useRef<Transport | null>(null);
  type Peer = { pc: RTCPeerConnection; dc: RTCDataChannel; queue: CandidateQueue };
  const peers = useRef(new Map<string, Peer>());
  const cropRef = useRef(crop);
  const dims = useRef({ w: 1920, h: 1080 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastTap = useRef(0);
  const sendQueued = useRef(false);

  const sendCrop = useCallback(() => {
    if (sendQueued.current) return; sendQueued.current = true;
    requestAnimationFrame(() => { sendQueued.current = false; const msg = JSON.stringify({ t: "crop", crop: cropRef.current }); for (const p of peers.current.values()) if (p.dc.readyState === "open") p.dc.send(msg); });
  }, []);
  useEffect(() => { cropRef.current = crop; sendCrop(); }, [crop, sendCrop]);
  const refreshPhase = useCallback(() => {
    const states = [...peers.current.values()].map((p) => p.pc.connectionState);
    setPhase(states.includes("connected") ? "live" : states.length ? (states.every((st) => st === "failed" || st === "disconnected") ? "lost" : "connecting") : "waiting");
  }, []);

  /* Fit the preview box to the stage with the frame's own aspect. */
  const fit = useCallback(() => {
    const st = stageRef.current; if (!st) return;
    const sw = st.clientWidth - 16, sh = st.clientHeight - 16, { w, h } = dims.current;
    const k = Math.min(sw / w, sh / h); setBox({ w: Math.floor(w * k), h: Math.floor(h * k) });
  }, []);
  useEffect(() => { if (phase === "gate" || phase === "error") return; const ro = new ResizeObserver(fit); if (stageRef.current) ro.observe(stageRef.current); fit(); return () => ro.disconnect(); }, [fit, phase]);

  /* The frame size the camera really delivers (portrait phones rotate it), read from the element itself. */
  const readDims = useCallback(() => {
    const v = videoRef.current; if (!v || !v.videoWidth || !v.videoHeight) return;
    if (dims.current.w === v.videoWidth && dims.current.h === v.videoHeight) return;
    dims.current = { w: v.videoWidth, h: v.videoHeight };
    setCrop((c) => clampCrop({ ...c, w: v.videoWidth, h: v.videoHeight })); fit();
  }, [fit]);
  const attach = useCallback((s: MediaStream) => {
    streamRef.current = s;
    const v = videoRef.current; if (v) { v.srcObject = s; v.onloadedmetadata = readDims; v.onresize = readDims; v.play().catch(() => {}); }
    const vt = s.getVideoTracks()[0]; const set = vt?.getSettings();
    if (set?.width && set?.height) { dims.current = { w: set.width, h: set.height }; setCrop(clampCrop({ ...defaultCrop(set.width, set.height), mirror: false })); fit(); }
    const caps = (vt?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }; setTorchOk(!!caps.torch);
  }, [fit, readDims]);
  useEffect(() => { const v = videoRef.current; if (v && streamRef.current && !v.srcObject) { v.srcObject = streamRef.current; v.onloadedmetadata = readDims; v.onresize = readDims; v.play().catch(() => {}); } }, [phase, readDims]);

  const closePeer = useCallback((id: string) => { const p = peers.current.get(id); if (p) { p.pc.close(); peers.current.delete(id); } }, []);
  const closeAll = useCallback(() => { for (const id of [...peers.current.keys()]) closePeer(id); }, [closePeer]);

  const offer = useCallback(async function offer(id: string) {
    const s = streamRef.current, sig = sigRef.current; if (!s || !sig) return;
    closePeer(id); setPhase("connecting");
    const pc = new RTCPeerConnection(rtcConfig); const queue = new CandidateQueue(pc);
    s.getTracks().forEach((t) => pc.addTrack(t, s));
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== "video") continue;
      const p = sender.getParameters(); p.encodings = [{ maxBitrate: 6_000_000, maxFramerate: 30 }]; p.degradationPreference = "maintain-resolution"; await sender.setParameters(p).catch(() => {});
    }
    const dc = pc.createDataChannel("ctl"); peers.current.set(id, { pc, dc, queue });
    dc.onopen = () => { dc.send(JSON.stringify({ t: "hello", label: /iPhone|iPad/.test(navigator.userAgent) ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android phone" : "phone" })); dc.send(JSON.stringify({ t: "crop", crop: cropRef.current })); };
    pc.onconnectionstatechange = () => { refreshPhase(); const mine = () => peers.current.get(id)?.pc === pc; if (pc.connectionState === "failed" && mine()) setTimeout(() => { if (mine()) offer(id); }, 800); if (pc.connectionState === "disconnected") setTimeout(() => { if (mine() && pc.connectionState === "disconnected") offer(id); }, 4000); };
    pc.oniceconnectionstatechange = () => setIce(pc.iceConnectionState);
    const o = await pc.createOffer(); await pc.setLocalDescription(o); sig.signal(await gathered(pc), id);
  }, [closePeer, refreshPhase]);

  const join = useCallback(() => {
    if (!room) return;
    const sig = createSignal(room, "phone"); sigRef.current = sig;
    sig.on(async (m) => {
      if (m.t === "joined") { closeAll(); if (m.peers.desks.length) m.peers.desks.forEach((id) => offer(id)); else setPhase("waiting"); }
      if (m.t === "peer" && m.id) { if (m.present) offer(m.id); else { closePeer(m.id); refreshPhase(); } }
      if (m.t === "replaced") { sig.close(); closeAll(); setPhase("lost"); }
      if (m.t === "signal" && m.id) {
        const p = m.payload as RTCSessionDescriptionInit & { candidate?: RTCIceCandidateInit }; const peer = peers.current.get(m.id); if (!peer) return;
        if (p.type === "answer") { await peer.pc.setRemoteDescription(p); await peer.queue.flush(); }
        else if (p.candidate) await peer.queue.push(p.candidate);
      }
    });
    sig.connect();
  }, [room, offer, closeAll, closePeer, refreshPhase]);

  const start = useCallback(async () => {
    setPhase("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      attach(s); setPhase("waiting"); join(); keepAwake();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setPhase("error"); }
  }, [facing, attach, join]);

  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const keepAwake = useCallback(async () => { try { wake.current = (await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")) ?? null; } catch { /* optional */ } }, []);
  useEffect(() => { const onVis = () => { if (document.visibilityState === "visible" && streamRef.current) keepAwake(); }; document.addEventListener("visibilitychange", onVis); return () => { document.removeEventListener("visibilitychange", onVis); wake.current?.release().catch(() => {}); }; }, [keepAwake]);

  const flip = useCallback(async () => {
    const s = streamRef.current; if (!s) return; const next = facing === "user" ? "environment" : "user";
    try {
      const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } } });
      const nv = ns.getVideoTracks()[0]; const ov = s.getVideoTracks()[0];
      for (const p of peers.current.values()) { const sender = p.pc.getSenders().find((x) => x.track?.kind === "video"); await sender?.replaceTrack(nv); }
      ov?.stop(); s.removeTrack(ov); s.addTrack(nv); attach(s); setFacing(next); setTorch(false);
    } catch { /* keep the current camera */ }
  }, [facing, attach]);

  const toggleMute = () => { const t = streamRef.current?.getAudioTracks()[0]; if (!t) return; t.enabled = muted; setMuted(!muted); };
  const toggleTorch = async () => { const t = streamRef.current?.getVideoTracks()[0]; if (!t) return; try { await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); setTorch(!torch); } catch { /* unsupported */ } };

  useEffect(() => { document.body.classList.add("dark-stage"); const sig = sigRef, st = streamRef; return () => { document.body.classList.remove("dark-stage"); closeAll(); sig.current?.close(); st.current?.getTracks().forEach((t) => t.stop()); }; }, [closeAll]);

  /* Fingers: one drags the frame, two pinch the zoom about the midpoint, a double-tap resets. */
  const onDown = (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); setTouching(true);
    if (pointers.current.size === 1) { const now = Date.now(); if (now - lastTap.current < 280) { setCrop((c) => ({ ...c, s: 1, cx: 0.5, cy: 0.5 })); } lastTap.current = now; } };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId); if (!prev) return;
    const pts = pointers.current; const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mir = facing === "user" ? -1 : 1;
    if (pts.size === 1) { setCrop((c) => panBy(c, (e.clientX - prev.x) * mir, e.clientY - prev.y, rect.width, rect.height)); }
    else if (pts.size === 2) {
      const [a, b] = [...pts.entries()]; const other = a[0] === e.pointerId ? b[1] : a[1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const mx0 = ((e.clientX + other.x) / 2 - rect.left) / rect.width, my = ((e.clientY + other.y) / 2 - rect.top) / rect.height, mx = mir < 0 ? 1 - mx0 : mx0;
      if (d0 > 0) setCrop((c) => zoomAbout(c, d1 / d0, mx, my));
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); if (!pointers.current.size) setTouching(false); };
  const onWheel = (e: React.WheelEvent) => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); const mx0 = (e.clientX - rect.left) / rect.width; setCrop((c) => zoomAbout(c, e.deltaY < 0 ? 1.08 : 0.92, facing === "user" ? 1 - mx0 : mx0, (e.clientY - rect.top) / rect.height)); };
  /* Keyboard and buttons for people who cannot pinch: arrows pan, plus and minus zoom, 0 resets. */
  const zoomStep = (f: number) => setCrop((c) => zoomAbout(c, f, 0.5, 0.5));
  const resetCrop = () => setCrop((c) => ({ ...c, s: 1, cx: 0.5, cy: 0.5 }));
  const onKey = (e: React.KeyboardEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); const step = 24 * (facing === "user" ? -1 : 1);
    if (e.key === "ArrowLeft") setCrop((c) => panBy(c, step, 0, rect.width, rect.height)); else if (e.key === "ArrowRight") setCrop((c) => panBy(c, -step, 0, rect.width, rect.height));
    else if (e.key === "ArrowUp") setCrop((c) => panBy(c, 0, 24, rect.width, rect.height)); else if (e.key === "ArrowDown") setCrop((c) => panBy(c, 0, -24, rect.width, rect.height));
    else if (e.key === "+" || e.key === "=") zoomStep(1.15); else if (e.key === "-") zoomStep(1 / 1.15); else if (e.key === "0") resetCrop(); else return;
    e.preventDefault();
  };

  if (phase === "gate" || phase === "error" || !room) {
    return (
      <div className="cam-gate">
        <motion.div className="pane" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}>
          <span className="status"><span className={`dot ${room ? "wait" : "off"}`} aria-hidden="true" />{room ? `Room ${room}` : "No Room Code"}</span>
          <h1>{room ? "Use This Phone As The Camera" : "Scan The Code First"}</h1>
          <p>{room ? "Camera and microphone, once. The picture goes only to the computer that showed you the code." : "Scan the code on the Bona page on your computer."}</p>
          {phase === "error" && <p className="hl">Camera not available: {err}. Check the site permissions for this page and try again.</p>}
          {room && <button className="btn" type="button" onClick={start}><Camera />Allow Camera And Microphone</button>}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="cam">
      <div className="cam-top">
        <span className="status" role="status"><span className={`dot ${phase === "live" ? "" : phase === "waiting" || phase === "lost" ? "off" : "wait"}`} aria-hidden="true" />{words[phase]}{phase !== "live" && ice && ice !== "connected" && ice !== "completed" ? ` · ${ice}` : ""}</span>
        <span className="fig-note" style={{ color: "rgba(255,255,255,.6)" }}>Room {room}</span>
      </div>
      <div className="cam-stage" ref={stageRef}>
        <div className={`cam-box${touching ? " touching" : ""}`} style={{ width: box.w || "100%", height: box.h || "60vh" }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} onKeyDown={onKey} tabIndex={0} role="group" aria-label="Live viewport. Pinch or use plus and minus to zoom, drag or arrow keys to frame, 0 to reset.">
          <div className={`mirror${facing === "user" ? " on" : ""}`}><video ref={videoRef} playsInline muted autoPlay style={{ transform: cropTransform(crop) }} /></div>
          <div className="grid" aria-hidden="true" />
          <AnimatePresence>{crop.s > 1.01 && <motion.span className="zoom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{crop.s.toFixed(1)}× · double-tap to reset</motion.span>}</AnimatePresence>
        </div>
      </div>
      <div className="cam-bottom">
        {(phase === "starting" || phase === "connecting") && <div className="cam-load"><GummyLoading dark label={phase === "starting" ? "Starting the camera" : "Connecting to the computer"} /></div>}
        <div className="cam-zoom"><span>1×</span><GummyBar dark label="Zoom" min={1} max={MAX_ZOOM} step={0.05} value={crop.s} onChange={(v) => setCrop((c) => zoomAbout(c, v / c.s, 0.5, 0.5))} /><span>{crop.s.toFixed(1)}×</span></div>
        <button className="btn small ghost" type="button" onClick={flip}><Flip />Flip</button>
        <button className="btn small ghost" type="button" aria-pressed={muted} onClick={toggleMute}>{muted ? <MicOff /> : <Mic />}Mute</button>
        <button className="btn small ghost" type="button" onClick={() => zoomStep(1.25)} aria-label="Zoom in">+</button>
        <button className="btn small ghost" type="button" onClick={() => zoomStep(0.8)} aria-label="Zoom out">−</button>
        <button className="btn small ghost" type="button" onClick={resetCrop} disabled={crop.s <= 1.01}>Reset</button>
        {torchOk && <button className="btn small ghost" type="button" aria-pressed={torch} onClick={toggleTorch}><Torch />Light</button>}
        <p className="cam-hint">Pinch to zoom, drag to frame. This is what the computer sees.</p>
      </div>
    </div>
  );
}
export default function Page() { return <Suspense fallback={null}><Cam /></Suspense>; }
