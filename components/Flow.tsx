"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";

/* How the picture travels: phone -> your Wi-Fi -> this window -> a virtual camera -> any app. Drawn to the real path,
 * and once a phone is live the dots start moving along it. */
export default function Flow({ live }: { live: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const W = 1000, H = 150, svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`);
    svg.selectAll("*").remove();
    const nodes = [
      { x: 60, t: "Your Phone", s: "Camera and mic" },
      { x: 280, t: "Your Wi-Fi", s: "Peer to peer, stays on the network" },
      { x: 500, t: "This Window", s: "Crop applied, audio optional" },
      { x: 720, t: "Bona Extension", s: "A camera device in your browser" },
      { x: 925, t: "Any Web App", s: "Meet · Zoom · Teams" },
    ];
    const y = 54;
    const path = svg.append("path").attr("d", d3.line<{ x: number }>().x((d) => d.x).y(() => y).curve(d3.curveLinear)(nodes) ?? "").attr("fill", "none").attr("stroke", "rgba(20,20,20,.18)").attr("stroke-width", 1.5);
    const dots = svg.append("path").attr("d", path.attr("d")).attr("fill", "none").attr("stroke", live ? "#1c6468" : "rgba(20,20,20,.3)").attr("stroke-width", 3).attr("stroke-linecap", "round").attr("stroke-dasharray", "0 14");
    if (live && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const run = () => dots.attr("stroke-dashoffset", 0).transition().duration(1400).ease(d3.easeLinear).attr("stroke-dashoffset", -28).on("end", run);
      run();
    }
    const g = svg.selectAll("g.n").data(nodes).join("g").attr("class", "n").attr("transform", (d) => `translate(${d.x},${y})`);
    g.append("circle").attr("r", 17).attr("fill", "#fff").attr("stroke", (_, i) => (i === 2 ? "#141414" : "rgba(20,20,20,.25)")).attr("stroke-width", 1.5);
    g.append("circle").attr("r", 5).attr("fill", (_, i) => (i === 2 ? "#141414" : i === 1 ? "#1c6468" : i === 3 ? "#7a5b17" : "#a1452b"));
    g.append("text").attr("y", 40).attr("text-anchor", "middle").attr("font-weight", 600).text((d) => d.t);
    g.append("text").attr("class", "sub").attr("y", 58).attr("text-anchor", "middle").text((d) => d.s);
    return () => { dots.interrupt(); };
  }, [live]);
  return <div className="flow"><svg ref={ref} role="img" aria-label="How the picture travels from the phone to any app" /></div>;
}
