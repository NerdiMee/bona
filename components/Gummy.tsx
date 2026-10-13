"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";

/* Gummy bars: soft rounded tracks with a glossy fill that moves on a spring and squishes while you hold it. */
const springy = { stiffness: 320, damping: 20, mass: 0.6 };

export function GummyBar({ value, min = 0, max = 1, step = 0.01, onChange, label, dark, format }: { value: number; min?: number; max?: number; step?: number; onChange?: (v: number) => void; label: string; dark?: boolean; format?: (v: number) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const spring = useSpring(pct, reduce ? { stiffness: 1000, damping: 100 } : springy);
  useEffect(() => { spring.set(pct); }, [pct, spring]);
  const width = useTransform(spring, (v) => `${Math.max(2.5, Math.min(100, v * 100))}%`);
  const setFrom = (clientX: number) => { const r = ref.current?.getBoundingClientRect(); if (!r || !onChange) return; const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width)); onChange(Math.round((min + f * (max - min)) / step) * step); };
  const onKey = (e: React.KeyboardEvent) => { if (!onChange) return; const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? step * 10 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step * 10 : 0; if (!d) return; e.preventDefault(); onChange(Math.max(min, Math.min(max, value + d))); };
  return (
    <div ref={ref} className={`gummy${onChange ? " is-interactive" : ""}${dark ? " dark" : ""}`} role={onChange ? "slider" : "progressbar"} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value * 100) / 100} aria-valuetext={format ? format(value) : undefined} tabIndex={onChange ? 0 : undefined} onKeyDown={onKey}
      onPointerDown={onChange ? (e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDrag(true); setFrom(e.clientX); } : undefined}
      onPointerMove={onChange ? (e) => { if (drag) setFrom(e.clientX); } : undefined}
      onPointerUp={onChange ? () => setDrag(false) : undefined} onPointerCancel={onChange ? () => setDrag(false) : undefined}>
      <motion.div className="gummy-track" animate={{ scaleY: drag ? 1.22 : 1 }} transition={{ type: "spring", stiffness: 420, damping: 16 }}>
        <motion.div className="gummy-fill" style={{ width }} />
        {onChange && <motion.div className="gummy-knob" style={{ left: width }} animate={{ scale: drag ? 1.28 : 1 }} transition={{ type: "spring", stiffness: 420, damping: 14 }} />}
      </motion.div>
      {format && <span className="gummy-val">{format(value)}</span>}
    </div>
  );
}

/* Indeterminate: a blob that stretches as it runs along the track, for "connecting" and "starting". */
export function GummyLoading({ label, dark }: { label: string; dark?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className={`gummy loading${dark ? " dark" : ""}`} role="progressbar" aria-label={label} aria-busy="true">
      <div className="gummy-track">
        <motion.div className="gummy-fill blob" animate={reduce ? { left: "30%", width: "40%" } : { left: ["0%", "62%", "0%"], width: ["22%", "38%", "22%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
      </div>
      <span className="gummy-val">{label}</span>
    </div>
  );
}

/* Microphone level as a row of gummy bars that spring up and down; the peak bar glows gold for a moment. */
export function GummyLevel({ level, peak, bars = 14, dark }: { level: number; peak: number; bars?: number; dark?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className={`gummy-level${dark ? " dark" : ""}`} role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(level * 100) / 100}>
      {Array.from({ length: bars }, (_, i) => { const thr = (i + 0.5) / bars; const on = level >= thr, pk = !on && peak >= thr && peak < thr + 1 / bars; return (
        <motion.span key={i} className={`lv${on ? " on" : ""}${pk ? " pk" : ""}`} animate={{ scaleY: on ? 1 : pk ? 0.7 : 0.22 }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 18 }} />
      ); })}
    </div>
  );
}
