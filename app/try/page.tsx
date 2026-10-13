"use client";
import { useEffect, useRef, useState } from "react";

/* A plain web page that asks for a camera the way any meeting site does. With the Bona extension installed and a
 * phone live, the device list shows "Bona Phone Camera" and the picture below is the phone's, cropped. */
export default function Try() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<{ kind: string; label: string }[]>([]);
  const [tracks, setTracks] = useState<string[]>([]);
  const [dims, setDims] = useState("");
  const [err, setErr] = useState("");
  const start = async () => {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const v = videoRef.current; if (v) { v.srcObject = s; await v.play().catch(() => {}); v.onloadedmetadata = () => setDims(`${v.videoWidth}×${v.videoHeight}`); setDims(`${v.videoWidth}×${v.videoHeight}`); }
      setTracks(s.getTracks().map((t) => `${t.kind}: ${t.label || "(unnamed)"}`));
      const list = await navigator.mediaDevices.enumerateDevices(); setDevices(list.filter((d) => d.kind !== "audiooutput").map((d) => ({ kind: d.kind, label: d.label || d.deviceId })));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { navigator.mediaDevices?.enumerateDevices().then((list) => setDevices(list.filter((d) => d.kind !== "audiooutput").map((d) => ({ kind: d.kind, label: d.label || d.deviceId })))).catch(() => {}); }, []);
  return (
    <div className="try">
      <span className="eyebrow">Extension Check</span>
      <h1>Does This Browser See The Phone?</h1>
      <p className="lede">This page asks for a camera exactly the way a meeting site does. With the Bona extension installed and your phone live, the camera below is your phone.</p>
      <button className="btn" type="button" onClick={start} id="try-start">Ask For A Camera</button>
      {err && <p className="hl" role="alert">Could not get a camera: {err}</p>}
      <div className="monitor"><video ref={videoRef} playsInline autoPlay muted /></div>
      <p className="fig-note" id="try-dims">{dims ? `Receiving ${dims}` : "No camera yet"}</p>
      <ul className="list" id="try-tracks">{tracks.map((t) => <li key={t}><b>{t.split(":")[0]}</b><span>{t.split(": ")[1]}</span></li>)}</ul>
      <p className="fig-note">Devices this page can see</p>
      <ul className="list" id="try-devices">{devices.map((d, i) => <li key={i}><b>{d.kind === "videoinput" ? "Camera" : "Microphone"}</b><span>{d.label}</span></li>)}</ul>
    </div>
  );
}
