"use client";
import { useEffect, useRef, useState } from "react";
import { cropTransform, type Crop } from "@/lib/crop";

/* Renders the phone's stream with the phone's crop. The video fills a 16:9 box exactly (object-fit contain inside a
 * same-aspect wrapper), so the normalised crop maps straight to a CSS transform. */
export default function Monitor({ stream, crop, audio, mirror, empty }: { stream: MediaStream | null; crop: Crop; audio: boolean; mirror: boolean; empty: React.ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [needsTap, setNeedsTap] = useState(false);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    v.srcObject = stream; v.muted = !audio;
    if (stream) v.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
  }, [stream, audio]);
  const aspect = crop.w && crop.h ? crop.w / crop.h : 16 / 9;
  return (
    <div className="monitor" style={{ aspectRatio: `${aspect}` }}>
      <div className={`mirror${mirror ? " on" : ""}`}>
        <video ref={ref} playsInline autoPlay style={{ transform: cropTransform(crop) }} />
      </div>
      {!stream && <div className="empty">{empty}</div>}
      {stream && needsTap && <button className="tap" type="button" onClick={() => ref.current?.play().then(() => setNeedsTap(false))}>Tap To Start Playback</button>}
    </div>
  );
}
