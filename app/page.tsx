"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import gsap from "gsap";
import QrCode from "@/components/QrCode";
import Monitor from "@/components/Monitor";
import LensWord from "@/components/LensWord";
import { Spark, useAudioLevel } from "@/components/Meters";
import { GummyLevel, GummyLoading } from "@/components/Gummy";
import { ArrowUpRight, Check, Copy, Expand, Lens, Mirror, Refresh, Sound } from "@/components/Icons";
import { useDesk, type Phase } from "@/lib/useDesk";
import { hosted, roomCode } from "@/lib/signal";

const statusText: Record<Phase, string> = { idle: "Starting", waiting: "Waiting For Your Phone", connecting: "Phone Found, Connecting", live: "Live From Your Phone", lost: "Phone Lost, Scan Again" };

export default function Home() {
  const [room, setRoom] = useState<string | null>(null);
  const [ips, setIps] = useState<string[]>([]);
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("");
  const [origin, setOrigin] = useState("");
  const [listen, setListen] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [copied, setCopied] = useState<"" | "link">("");
  const monRef = useRef<HTMLDivElement>(null);
  const desk = useDesk(room);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      let r = ""; try { r = sessionStorage.getItem("bona-room") ?? ""; } catch { /* private mode */ }
      const q = new URLSearchParams(location.search).get("r"); if (q && /^[a-z0-9]{6,12}$/i.test(q)) r = q; // open a room from another browser or device
      if (!r) r = roomCode();
      try { sessionStorage.setItem("bona-room", r); } catch { /* ignore */ }
      setRoom(r); setOrigin(location.origin); setPort(location.port || "443");
      document.documentElement.dataset.bonaRoom = r; document.documentElement.dataset.bonaHosted = hosted ? "1" : "0";
      const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
      if (hosted && !local) setIp(location.hostname);
      else fetch("/api/host").then((x) => x.json()).then((h: { ips: string[]; port: string }) => { setIps(h.ips); setIp(h.ips[0] ?? location.hostname); }).catch(() => setIp(location.hostname));
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) { gsap.set("[data-hero-line]", { opacity: 1 }); return; }
      gsap.fromTo("[data-hero-line]", { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", stagger: 0.1 });
      gsap.fromTo("[data-hero-fade]", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out", stagger: 0.08, delay: 0.3 });
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const camUrl = room && ip ? (hosted && ip === (origin && new URL(origin).hostname) && !/^(localhost|127\.0\.0\.1)$/.test(ip) ? `${origin}/cam?r=${room}` : `https://${ip}:${port}/cam?r=${room}`) : "";
  const cleanUrl = room ? `${origin}/view/clean?r=${room}` : "";
  const live = desk.phase === "live" && !!desk.stream;
  const copy = async () => { try { await navigator.clipboard.writeText(camUrl); setCopied("link"); setTimeout(() => setCopied(""), 1600); } catch { window.prompt("Copy this address", camUrl); } };
  const newCode = () => { const r = roomCode(); try { sessionStorage.setItem("bona-room", r); } catch { /* ignore */ } document.documentElement.dataset.bonaRoom = r; setRoom(r); };
  const fullscreen = () => monRef.current?.querySelector(".monitor")?.requestFullscreen?.().catch(() => {});
  const stepDone = [desk.phase !== "waiting" && desk.phase !== "idle", live, live && desk.crop.s > 1.01];
  const dot = desk.phase === "live" ? "" : desk.phase === "waiting" || desk.phase === "idle" ? "off" : "wait";

  return (
    <>
      <header className="nav">
        <div className="nav-in">
          <a className="nav-brand" href="#top"><span className="mark"><Lens /></span><LensWord text="Bona" /></a>
          <nav className="links" aria-label="Site"><a href="#apps">In Your Meeting</a><a href="/try">Check The Browser</a></nav>
          <div className="right"><span className="status" role="status"><span className={`dot ${dot}`} aria-hidden="true" />{statusText[desk.phase]}</span></div>
        </div>
      </header>
      <main id="top">
        <section className="hero" aria-labelledby="hero-h">
          <div>
            <span className="eyebrow" data-hero-fade>Bona · Broadcast Over Network Anywhere</span>
            <h1 id="hero-h" className="hero-title"><span className="outline" data-hero-line><LensWord text="Your Phone" /></span><span className="solid" data-hero-line><LensWord text="Is The Camera." /></span></h1>
            <p className="lede" data-hero-fade>Scan, allow the camera, frame it with your fingers. Done.</p>
            <ol className="steps" data-hero-fade>
              {[["Scan", "Open the code with your phone's camera."], ["Allow", "Say yes to camera and microphone, once."], ["Frame", "Pinch and drag on the phone. The picture follows here."]].map(([t, d], i) => (
                <li key={t} className={stepDone[i] ? "done" : ""}><span className="n">{stepDone[i] ? <Check /> : `0${i + 1}`}</span><span><b>{t}</b>{d}</span></li>
              ))}
            </ol>
          </div>
          <div className="pane" ref={monRef}>
            <AnimatePresence mode="wait" initial={false}>
              {!live ? (
                <motion.div key="qr" className="qr-pane" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}>
                  <div className="qr">{camUrl ? <QrCode text={camUrl} label={`Code that opens ${camUrl} on your phone`} /> : null}</div>
                  <p className="qr-code"><span className="sr-only">Room code </span>{room ?? "········"}</p>
                  <p className="qr-url">{camUrl ? (hosted && !camUrl.includes("192.") ? "Same Wi-Fi as this computer" : camUrl) : "Finding this computer's address"}</p>
                  {ips.length > 1 && <p className="fig-note">Other addresses: {ips.filter((x) => x !== ip).map((x) => <button key={x} type="button" className="link-arrow" style={{ marginLeft: 8, fontSize: 13 }} onClick={() => setIp(x)}>{x}</button>)}</p>}
                  <div className="qr-foot">
                    <button className="btn small ghost" type="button" onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy Link"}</button>
                    <button className="btn small ghost" type="button" onClick={newCode}><Refresh />New Code</button>
                  </div>
                  {desk.phase === "connecting" && <GummyLoading label="Phone found, bringing the picture over" />}
                  {(desk.phase === "connecting" || desk.phase === "lost") && desk.diag && <p className="diag" role="status">{desk.diag}</p>}
                  {desk.phase !== "waiting" && desk.phase !== "idle" && <p className="fig-note" style={{ textAlign: "center" }}>{desk.phase === "connecting" ? "Phone found, bringing the picture over." : desk.phase === "lost" ? "The phone dropped off. Open the link again." : ""}</p>}
                  {!hosted && <p className="fig-note" style={{ textAlign: "center" }}>iPhone and the page never connects? <a className="hl" href="/api/cert">Install this computer&rsquo;s certificate</a> once, then trust it under Settings → General → About → Certificate Trust Settings.</p>}
                </motion.div>
              ) : (
                <motion.div key="mon" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}>
                  <Monitor stream={desk.stream} crop={desk.crop} audio={listen} mirror={mirror} empty={<span><b>Waiting For The Picture</b>The phone is connected.</span>} />
                  <div className="mon-bar">
                    <button className="btn small ghost" type="button" aria-pressed={listen} onClick={() => setListen((v) => !v)}><Sound />Listen</button>
                    <button className="btn small ghost" type="button" aria-pressed={mirror} onClick={() => setMirror((v) => !v)}><Mirror />Mirror</button>
                    <button className="btn small ghost" type="button" onClick={fullscreen}><Expand />Fullscreen</button>
                    <a className="btn small ghost" href={cleanUrl} target="_blank" rel="noreferrer">Clean Window<ArrowUpRight /></a>
                  </div>
                  <div className="stats">
                    <div className="stat"><b>{desk.stats.w ? `${desk.stats.w}×${desk.stats.h}` : "…"}</b>{Math.round(desk.stats.fps)} fps · {Math.round(desk.stats.kbps)} kbps · {Math.round(desk.stats.rtt)} ms</div>
                    <Spark values={desk.history} />
                    <LiveLevel stream={desk.stream} />
                  </div>
                  <p className="fig-note" style={{ marginTop: 10 }}>{desk.label ? `From your ${desk.label}` : "From your phone"}{desk.crop.s > 1.01 ? ` · ${desk.crop.s.toFixed(1)}×` : ""} · Meeting apps see this as Bona Phone Camera.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <section className="sec" id="apps" aria-labelledby="apps-h">
          <div className="sec-head"><div><span className="eyebrow">In Your Meeting</span><h2 id="apps-h"><LensWord text="Three Taps, Once" /></h2></div></div>
          <ul className="guide">
            <li><span className="n">1</span><h3>Add The Bona Extension</h3><p>Firefox Developer Edition: <code>about:debugging</code> → This Firefox → Load Temporary Add-on → the .xpi. Chrome: unzip, then Load unpacked at <code>chrome://extensions</code>.</p><a className="btn small" href="/bona-extension.xpi">Firefox<ArrowUpRight /></a> <a className="btn small ghost" href="/bona-extension.zip" style={{ marginLeft: 8 }}>Chrome<ArrowUpRight /></a></li>
            <li><span className="n">2</span><h3>Allow The Site</h3><p>On Meet, Zoom, Teams or Discord in the browser, click the Bona button in the toolbar and choose Allow. The browser asks once for access to that site.</p></li>
            <li><span className="n">3</span><h3>Pick Bona Phone Camera</h3><p>In the app&rsquo;s camera settings. Done. <a className="hl" href="/try">Check it works</a>.</p></li>
          </ul>
          <p className="fig-note" style={{ marginTop: 24 }}><b>No extension?</b> Open the Clean Window from the monitor above and share that window in the meeting (Share screen → Window). Works in every app, as a shared window rather than a camera. Installed desktop apps need a camera driver Bona does not ship yet. The picture stays on your Wi-Fi, peer to peer; the relay only carries the handshake.</p>
        </section>
      </main>
      <footer><div className="foot-in"><span className="foot-line">Bona · Broadcast Over Network Anywhere{room ? ` · Room ${room}` : ""}</span><a className="foot-credit" href="https://nerdimee.io" target="_blank" rel="noopener">Created By Nerdimee.io</a></div></footer>
    </>
  );
}

/* The 20 Hz level lives in its own component so the rest of the page stays still. */
function LiveLevel({ stream }: { stream: MediaStream | null }) { const a = useAudioLevel(stream); return <GummyLevel level={a.level} peak={a.peak} />; }
