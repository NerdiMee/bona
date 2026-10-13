"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Monitor from "@/components/Monitor";
import { useDesk } from "@/lib/useDesk";

/* The output window: the picture on black, nothing else. Point an OBS Browser source (or a window capture) here. */
function Clean() {
  const params = useSearchParams();
  const room = params.get("r");
  const mirror = params.get("mirror") === "1";
  const desk = useDesk(room);
  useEffect(() => { document.body.classList.add("dark-stage"); return () => document.body.classList.remove("dark-stage"); }, []);
  return (
    <div className="clean">
      <Monitor stream={desk.stream} crop={desk.crop} audio mirror={mirror} empty={<span><b>{room ? "Waiting For Your Phone" : "No Room Code"}</b>{room ? `Room ${room}` : "Open this window from the Bona page."}</span>} />
    </div>
  );
}
export default function Page() { return <Suspense fallback={null}><Clean /></Suspense>; }
