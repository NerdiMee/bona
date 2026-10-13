"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

/* Bitrate over the last minute: a thin line with a faint area and an emphasised endpoint. */
export function Spark({ values, max }: { values: number[]; max?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const W = 240, H = 44, svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "none");
    const v = values.length ? values : [0];
    const x = d3.scaleLinear().domain([0, Math.max(1, v.length - 1)]).range([0, W]), y = d3.scaleLinear().domain([0, max ?? Math.max(1, d3.max(v) ?? 1)]).range([H - 2, 4]);
    const line = d3.line<number>().x((_, i) => x(i)).y((d) => y(d)).curve(d3.curveMonotoneX);
    const area = d3.area<number>().x((_, i) => x(i)).y0(H).y1((d) => y(d)).curve(d3.curveMonotoneX);
    svg.selectAll("path.a").data([v]).join("path").attr("class", "a").attr("fill", "#1c6468").attr("fill-opacity", 0.1).attr("d", area);
    svg.selectAll("path.l").data([v]).join("path").attr("class", "l").attr("fill", "none").attr("stroke", "#1c6468").attr("stroke-width", 1.6).attr("d", line);
    svg.selectAll("circle.e").data([v[v.length - 1]]).join("circle").attr("class", "e").attr("r", 3).attr("fill", "#1c6468").attr("stroke", "#fff").attr("stroke-width", 1.5).attr("cx", x(v.length - 1)).attr("cy", (d) => y(d));
  }, [values, max]);
  return <div className="spark"><svg ref={ref} aria-hidden="true" /></div>;
}

/* Microphone level as a short arc: quiet grey track, the live level in teal, peak hold in gold. */
export function Meter({ level, peak }: { level: number; peak: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const svg = d3.select(el).attr("viewBox", "0 0 64 44");
    const arc = d3.arc<{ a: number }>().innerRadius(22).outerRadius(28).startAngle(-Math.PI / 2).endAngle((d) => -Math.PI / 2 + Math.PI * d.a).cornerRadius(3);
    const g = svg.selectAll<SVGGElement, null>("g.m").data([null]).join("g").attr("class", "m").attr("transform", "translate(32,34)");
    g.selectAll("path.t").data([{ a: 1 }]).join("path").attr("class", "t").attr("fill", "rgba(20,20,20,.1)").attr("d", arc);
    g.selectAll("path.v").data([{ a: Math.max(0.02, Math.min(1, level)) }]).join("path").attr("class", "v").attr("fill", "#1c6468").attr("d", arc);
    const pa = -Math.PI / 2 + Math.PI * Math.min(1, peak);
    g.selectAll("line.p").data([pa]).join("line").attr("class", "p").attr("stroke", "#7a5b17").attr("stroke-width", 2).attr("stroke-linecap", "round")
      .attr("x1", (a) => Math.sin(a) * 20).attr("y1", (a) => -Math.cos(a) * 20).attr("x2", (a) => Math.sin(a) * 30).attr("y2", (a) => -Math.cos(a) * 30);
  }, [level, peak]);
  return <div className="meter"><svg ref={ref} aria-hidden="true" /></div>;
}

/* Reads a stream's audio level ~20 times a second. */
export function useAudioLevel(stream: MediaStream | null) {
  const [val, setVal] = useState({ level: 0, peak: 0 });
  useEffect(() => {
    if (!stream || !stream.getAudioTracks().length) return;
    const Ctx = window.AudioContext; if (!Ctx) return;
    const ctx = new Ctx(); ctx.resume().catch(() => {}); const kick = () => ctx.resume().catch(() => {}); document.addEventListener("pointerdown", kick, { once: true }); const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
    const buf = new Float32Array(an.fftSize); let peak = 0, raf = 0, last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick); if (t - last < 50) return; last = t;
      an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const rms = Math.sqrt(s / buf.length), level = Math.min(1, rms * 4); peak = Math.max(level, peak * 0.97);
      const l2 = Math.round(level * 100) / 100, p2 = Math.round(peak * 100) / 100; setVal((v) => (v.level === l2 && v.peak === p2 ? v : { level: l2, peak: p2 }));
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("pointerdown", kick); src.disconnect(); ctx.close().catch(() => {}); setVal({ level: 0, peak: 0 }); };
  }, [stream]);
  return val;
}

/* Keeps the 20 Hz level updates inside one small component so the page around it stays still. */
export function LevelMeter({ stream }: { stream: MediaStream | null }) { const a = useAudioLevel(stream); return <Meter level={a.level} peak={a.peak} />; }
