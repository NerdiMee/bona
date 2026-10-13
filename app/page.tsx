"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import gsap from "gsap";
import QrCode from "@/components/QrCode";
import Monitor from "@/components/Monitor";
import Flow from "@/components/Flow";
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
  const stepDone = [desk.phase !== "waiting" && desk.phase !== "idle", live, live && desk.crop.s > 1.01, false];
  const dot = desk.phase === "live" ? "" : desk.phase === "waiting" || desk.phase === "idle" ? "off" : "wait";

  return (
    <>
      <header className="nav">
        <div className="nav-in">
          <a className="nav-brand" href="#top"><span className="mark"><Lens /></span><LensWord text="Bona" /></a>
          <nav className="links" aria-label="Site"><a href="#how">How It Works</a><a href="#apps">Use It In Apps</a><a href="/try">Check The Browser</a></nav>
          <div className="right"><span className="status" role="status"><span className={`dot ${dot}`} aria-hidden="true" />{statusText[desk.phase]}</span></div>
        </div>
      </header>
      <main id="top">
        <section className="hero" aria-labelledby="hero-h">
          <div>
            <span className="eyebrow" data-hero-fade>Bona · Broadcast Over Network Anywhere</span>
            <h1 id="hero-h" className="hero-title"><span className="outline" data-hero-line><LensWord text="Your Phone" /></span><span className="solid" data-hero-line><LensWord text="Is The Camera." /></span></h1>
            <p className="lede" data-hero-fade>Scan the code, allow the camera once, and frame the shot with your fingers. The picture reaches this computer over your own Wi-Fi and appears as a camera in every web app, with no cloud and no account.</p>
            <ol className="steps" data-hero-fade>
              {[["Scan The Code", hosted ? "Point your phone's camera at the code and open the link. No app, no account, nothing to install." : "Point your phone's camera at the code and open the link. Accept the one-time certificate note; it is this computer's own."], ["Allow Camera And Microphone", "Your phone asks once. The live viewport appears on the phone's screen."], ["Crop With Your Fingers", "Pinch to zoom, drag to frame, double-tap to reset. The crop follows here instantly."], ["Pick Bona In Your App", "Allow the site from the Bona toolbar button, then choose Bona Phone Camera in its device list."]].map(([t, s], i) => (
                <li key={t} className={stepDone[i] ? "done" : ""}><span className="n">{stepDone[i] ? <Check /> : `0${i + 1}`}</span><span><b>{t}</b>{s}</span></li>
              ))}
            </ol>
          </div>
          <div className="pane" ref={monRef}>
            <AnimatePresence mode="wait" initial={false}>
              {!live ? (
                <motion.div key="qr" className="qr-pane" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}>
                  <div className="qr">{camUrl ? <QrCode text={camUrl} label={`Code that opens ${camUrl} on your phone`} /> : null}</div>
                  <p className="qr-code"><span className="sr-only">Room code </span>{room ?? "········"}</p>
                  <p className="qr-url">{camUrl || "Finding this computer's address"}</p>
                  {ips.length > 1 && <p className="fig-note">Other addresses: {ips.filter((x) => x !== ip).map((x) => <button key={x} type="button" className="link-arrow" style={{ marginLeft: 8, fontSize: 13 }} onClick={() => setIp(x)}>{x}</button>)}</p>}
                  <div className="qr-foot">
                    <button className="btn small ghost" type="button" onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy Link"}</button>
                    <button className="btn small ghost" type="button" onClick={newCode}><Refresh />New Code</button>
                  </div>
                  {desk.phase === "connecting" && <GummyLoading label="Phone found, bringing the picture over" />}
                  {(desk.phase === "connecting" || desk.phase === "lost") && desk.diag && <p className="diag" role="status">{desk.diag}</p>}
                  <p className="fig-note" style={{ textAlign: "center" }}>{desk.phase === "connecting" ? "Phone found. Waiting for the picture." : desk.phase === "lost" ? "The phone dropped off. Open the link again." : (hosted ? "Same Wi-Fi as this computer. Only the handshake passes through Bona's relay; the picture never does." : "Same Wi-Fi as this computer. Nothing is uploaded anywhere.")}</p>
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
                  <p className="fig-note" style={{ marginTop: 10 }}>{desk.label ? `From ${desk.label}` : ""}{desk.crop.s > 1.01 ? ` · cropped ${desk.crop.s.toFixed(1)}×` : ""} · Web apps with the Bona extension see this picture as Bona Phone Camera.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <section className="sec" id="how" aria-labelledby="how-h">
          <div className="sec-head"><div><span className="eyebrow">The Path</span><h2 id="how-h"><LensWord text="How The Picture Travels" /></h2></div></div>
          <p className="sec-intro">The phone opens this site and sends video and audio straight to this computer with WebRTC, peer to peer on your Wi-Fi. Bona&rsquo;s relay only carries the handshake, a few kilobytes that say where to find each other; it never sees a frame. The Bona browser extension then offers the picture to every web app as a camera of its own. The dots start moving once your phone is live.</p>
          <Flow live={live} />
        </section>

        <section className="sec" id="apps" aria-labelledby="apps-h">
          <div className="sec-head"><div><span className="eyebrow">Any Web App</span><h2 id="apps-h"><LensWord text="Use It In Meet, Zoom, Teams And The Rest" /></h2></div></div>
          <p className="sec-intro">Add the Bona extension to your browser once. On each site you allow, <b>Bona Phone Camera</b> and <b>Bona Phone Microphone</b> appear in the device list, and while a phone is live they are the devices that site gets by default.</p>
          <ul className="guide">
            <li><span className="n">STEP 1</span><h3>Add The Bona Extension</h3><p><b>Firefox Developer Edition:</b> open <code>about:debugging</code>, choose This Firefox, Load Temporary Add-on, and pick the <code>.xpi</code>. To keep it after a restart, set <code>xpinstall.signatures.required</code> to false in <code>about:config</code> and open the <code>.xpi</code> directly.</p><p><b>Chrome, Edge, Brave:</b> unzip, open <code>chrome://extensions</code>, turn on Developer mode, Load unpacked, choose the folder.</p><a className="btn small" href="/bona-extension.xpi">Download For Firefox<ArrowUpRight /></a> <a className="btn small ghost" href="/bona-extension.zip" style={{ marginLeft: 8 }}>Download Zip<ArrowUpRight /></a></li>
            <li><span className="n">STEP 2</span><h3>Allow The Site, Then Pick Bona</h3><p>On Google Meet, Zoom on the web, Microsoft Teams on the web, Discord in the browser, Omegle and the rest: click the Bona button in the toolbar, choose <b>Allow Bona On This Site</b>, reload once. Then open the camera settings and choose <b>Bona Phone Camera</b>; for the phone&rsquo;s microphone choose <b>Bona Phone Microphone</b>. Sites you have not allowed never see the phone.</p><a className="link-arrow" href="/try">Check that this browser sees the phone<ArrowUpRight /></a></li>
            <li><span className="n">STEP 3</span><h3>Desktop Apps</h3><p>Zoom&rsquo;s desktop app, TeamSpeak and other installed programs read cameras from the operating system, which needs a signed camera driver. Bona does not ship one yet. Their web versions work with the extension today: <code>zoom.us/wc/join</code>, <code>teams.microsoft.com</code>, <code>discord.com/app</code>.</p></li>
          </ul>
        </section>

        <section className="sec" id="notes" aria-labelledby="notes-h">
          <div className="sec-head"><div><span className="eyebrow">Good To Know</span><h2 id="notes-h"><LensWord text="Private By Construction" /></h2></div></div>
          <ul className="guide">
            <li><span className="n">NETWORK</span><h3>The Picture Never Leaves Your Wi-Fi</h3><p>Video and audio travel peer to peer between the phone and this computer. The relay sees only the handshake, never a frame, and no STUN or TURN server is used.</p></li>
            <li><span className="n">CODES</span><h3>A Code Is The Only Key</h3><p>Eight random characters, new whenever you ask. Anyone who scans an old code lands nowhere. Make a new one after a call in a shared space.</p></li>
            <li><span className="n">NO SETUP</span><h3>Nothing To Install On The Phone</h3><p>Bona lives at a real HTTPS address, so every phone trusts it out of the box. No certificate, no profile, no app store. Running Bona offline on your own machine is still possible; that mode uses the computer&rsquo;s own certificate.</p></li>
          </ul>
        </section>
      </main>
      <section className="band" id="close" aria-labelledby="band-h">
        <h2 id="band-h">Point Your Phone At Anything</h2>
        <p>A better lens than the laptop lid, from wherever you stand. Codes expire when you make a new one.</p>
        <button className="btn" type="button" onClick={newCode}><Refresh />Make A New Code</button>
      </section>
      <footer><div className="foot-in"><span>Bona · Broadcast Over Network Anywhere · runs on this computer only</span><span>{room ? `Room ${room}` : ""}</span></div></footer>
    </>
  );
}

/* The 20 Hz level lives in its own component so the rest of the page stays still. */
function LiveLevel({ stream }: { stream: MediaStream | null }) { const a = useAudioLevel(stream); return <GummyLevel level={a.level} peak={a.peak} />; }
