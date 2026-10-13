"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import QRCode from "qrcode";

/* The code drawn with D3 so it can arrive the way the rest of the page does: modules settle in from the centre out,
 * finder patterns as rounded rings. Still a plain QR to any camera: dark modules on a light ground, quiet zone kept. */
export default function QrCode({ text, label }: { text: string; label: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !text) return;
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const n = qr.modules.size, data = qr.modules.data as Uint8Array, q = 2, S = n + q * 2;
    const inFinder = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    const cells: { x: number; y: number; d: number }[] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (data[y * n + x] && !inFinder(x, y)) cells.push({ x, y, d: Math.hypot(x - n / 2, y - n / 2) });
    const svg = d3.select(ref.current).attr("viewBox", `0 0 ${S} ${S}`);
    svg.selectAll("*").remove();
    svg.append("rect").attr("width", S).attr("height", S).attr("rx", 1.2).attr("fill", "#fff");
    const g = svg.append("g").attr("transform", `translate(${q},${q})`);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    g.selectAll("rect.m").data(cells).join("rect").attr("class", "m").attr("x", (c) => c.x + 0.06).attr("y", (c) => c.y + 0.06).attr("width", 0.88).attr("height", 0.88).attr("rx", 0.22).attr("fill", "#141414")
      .attr("opacity", reduce ? 1 : 0).transition().duration(420).delay((c) => c.d * 18).ease(d3.easeCubicOut).attr("opacity", 1);
    const finder = (fx: number, fy: number) => {
      const f = g.append("g").attr("transform", `translate(${fx},${fy})`).attr("opacity", reduce ? 1 : 0);
      f.append("rect").attr("width", 7).attr("height", 7).attr("rx", 1.6).attr("fill", "#141414");
      f.append("rect").attr("x", 1).attr("y", 1).attr("width", 5).attr("height", 5).attr("rx", 1).attr("fill", "#fff");
      f.append("rect").attr("x", 2).attr("y", 2).attr("width", 3).attr("height", 3).attr("rx", 0.7).attr("fill", "#141414");
      f.transition().duration(500).delay(80).attr("opacity", 1);
    };
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  }, [text]);
  return <svg ref={ref} role="img" aria-label={label} shapeRendering="geometricPrecision" />;
}
