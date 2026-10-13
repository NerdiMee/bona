/* Bona Phone Camera · runs in the page. On sites the user has allowed, it offers "Bona Phone Camera" and
 * "Bona Phone Microphone" as devices and answers the phone's WebRTC offer in the page, cropped the way the
 * phone chose. All signalling goes through the extension's background; the page itself never reaches Bona. */
(() => {
  if (window.__bonaPhoneCamera) return; window.__bonaPhoneCamera = true;
  const path = location.pathname;
  if (path.startsWith("/cam") || path.startsWith("/view/")) return; // Bona's own phone and output pages keep the real camera
  const md = navigator.mediaDevices; if (!md || !md.getUserMedia) return;
  const CH = "bona-phone-camera", VID = "bona-phone-camera", AID = "bona-phone-microphone";
  const origGUM = md.getUserMedia.bind(md), origEnum = md.enumerateDevices.bind(md);
  const waiting = new Map(); let seq = 0, onWs = null, onWsClosed = null;
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data[CH] !== "res" || !e.data.m || typeof e.data.m !== "object") return;
    const m = e.data.m;
    if (typeof m.ws === "string") { onWs && onWs(m.ws); return; }
    if (m.wsClosed) { onWsClosed && onWsClosed(); return; }
    const w = waiting.get(m.res); if (!w) return; waiting.delete(m.res); m.ok ? w.resolve(m.data) : w.reject(new DOMException(String(m.error || "Bona error"), "NotFoundError"));
  });
  const ask = (type, data) => new Promise((resolve, reject) => { const id = ++seq; waiting.set(id, { resolve, reject }); window.postMessage({ [CH]: "req", m: { id, type, data } }, "*"); setTimeout(() => { if (waiting.delete(id)) reject(new DOMException("Bona extension did not answer.", "NotFoundError")); }, 8000); });
  const num = (v) => typeof v === "number" && Number.isFinite(v);
  let session = null, enabled = false;

  const asDevice = (deviceId, kind, label) => { const d = { deviceId, groupId: "bona-phone", kind, label }; d.toJSON = () => ({ deviceId, groupId: "bona-phone", kind, label }); return d; };
  const ids = (spec) => { if (!spec || typeof spec !== "object") return []; const v = spec.deviceId; if (!v) return []; if (typeof v === "string") return [v]; const out = []; for (const k of ["exact", "ideal"]) { const x = v[k]; if (typeof x === "string") out.push(x); else if (Array.isArray(x)) out.push(...x); } return out; };
  const wantsLens = (spec, id) => ids(spec).includes(id);
  const wantsOther = (spec, id) => { const l = ids(spec); return l.length > 0 && !l.includes(id); };

  function connect(code) {
    return new Promise(async (resolve, reject) => {
      let pc = null, raw = new MediaStream(), crop = { s: 1, cx: 0.5, cy: 0.5 }, pending = [], ready = false, done = false;
      const fail = (msg) => { if (done) return; done = true; clearTimeout(timer); try { pc && pc.close(); } catch {} ask("ws-close").catch(() => {}); reject(new DOMException(msg, "NotReadableError")); };
      const timer = setTimeout(() => fail("Bona: the phone did not answer in time."), 15000);
      const send = (payload) => ask("ws-send", JSON.stringify({ t: "signal", payload })).catch(() => {});
      const finish = () => {
        if (done) return; done = true; clearTimeout(timer);
        const video = document.createElement("video"); video.muted = true; video.playsInline = true; video.srcObject = new MediaStream(raw.getVideoTracks()); video.play().catch(() => {});
        const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d"); let stopped = false;
        const draw = () => {
          if (stopped) return;
          const w = video.videoWidth, h = video.videoHeight;
          if (w && h) { const cw = Math.max(2, Math.round(w / crop.s)), ch = Math.max(2, Math.round(h / crop.s)); if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; } ctx.drawImage(video, (crop.cx - 0.5 / crop.s) * w, (crop.cy - 0.5 / crop.s) * h, cw, ch, 0, 0, cw, ch); }
          if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(draw); else requestAnimationFrame(draw);
        };
        canvas.width = 1280; canvas.height = 720; draw();
        const out = canvas.captureStream(30); raw.getAudioTracks().forEach((t) => out.addTrack(t));
        const brand = (track, id, label) => { try { Object.defineProperty(track, "label", { value: label }); const gs = track.getSettings.bind(track); Object.defineProperty(track, "getSettings", { value: () => ({ ...gs(), deviceId: id, groupId: "bona-phone" }) }); } catch {} };
        out.getVideoTracks().forEach((t) => brand(t, VID, "Bona Phone Camera")); out.getAudioTracks().forEach((t) => brand(t, AID, "Bona Phone Microphone"));
        session = { stream: out, stop: () => { stopped = true; try { pc.close(); } catch {} ask("ws-close").catch(() => {}); session = null; } };
        out.getVideoTracks()[0].addEventListener("ended", () => session && session.stop());
        resolve(out);
      };
      onWsClosed = () => { if (!done) fail("Bona closed the connection."); else if (session) session.stop(); };
      onWs = async (text) => {
        let m; try { m = JSON.parse(text); } catch { return; }
        if (!m || typeof m !== "object") return;
        if (m.t === "peer" && m.role === "phone" && !m.present && session) session.stop();
        if (m.t !== "signal" || !m.payload || typeof m.payload !== "object") return;
        const p = m.payload;
        try {
          if (p.type === "offer") {
            pc = new RTCPeerConnection({ iceServers: [] });
            pc.ontrack = (ev) => { raw.addTrack(ev.track); if (raw.getVideoTracks().length) finish(); };
            pc.ondatachannel = (ev) => { ev.channel.onmessage = (x) => { try { const c = JSON.parse(x.data); const k = c && c.crop; if (c && c.t === "crop" && k && num(k.s) && num(k.cx) && num(k.cy) && k.s >= 1 && k.s <= 8) crop = { s: k.s, cx: k.cx, cy: k.cy }; } catch {} }; };
            pc.onconnectionstatechange = () => { if ((pc.connectionState === "failed" || pc.connectionState === "closed") && session) session.stop(); };
            await pc.setRemoteDescription(p); ready = true; for (const c of pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
            const a = await pc.createAnswer(); await pc.setLocalDescription(a);
            if (pc.iceGatheringState !== "complete") await new Promise((r) => { const t = setTimeout(r, 1500); pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(t); r(); } }); });
            send(pc.localDescription.toJSON());
          } else if (p.candidate && typeof p.candidate === "object") { if (ready && pc) await pc.addIceCandidate(p.candidate).catch(() => {}); else pending.push(p.candidate); }
        } catch (err) { fail("Bona: " + (err && err.message ? err.message : "signalling failed")); }
      };
      try { await ask("ws-open"); await ask("ws-send", JSON.stringify({ t: "join", room: code, role: "desk" })); } catch (err) { fail(err && err.message ? err.message : "Bona is not running on this computer."); }
    });
  }
  async function lensStream() {
    if (session && session.stream.active) return session.stream;
    const j = await ask("rooms"); const code = j && j.rooms && j.rooms[0] ? j.rooms[0].code : null;
    if (!code) throw new DOMException("Bona: no phone is live. Open Bona and scan the code.", "NotFoundError");
    return connect(code);
  }

  md.enumerateDevices = async () => { const list = await origEnum(); if (!enabled) return list; return [asDevice(VID, "videoinput", "Bona Phone Camera"), asDevice(AID, "audioinput", "Bona Phone Microphone"), ...list]; };
  md.getUserMedia = async (c) => {
    c = c || {};
    if (!enabled) return origGUM(c);
    const askV = !!c.video, askA = !!c.audio;
    const explicitV = wantsLens(c.video, VID), explicitA = wantsLens(c.audio, AID);
    const useV = askV && (explicitV || !wantsOther(c.video, VID)), useA = askA && (explicitA || !wantsOther(c.audio, AID));
    if (!useV && !useA) return origGUM(c);
    let lens = null;
    try { lens = await lensStream(); } catch (err) { if (explicitV || explicitA) throw err; return origGUM(c); }
    const out = new MediaStream();
    if (useV) lens.getVideoTracks().forEach((t) => out.addTrack(t));
    if (useA) lens.getAudioTracks().forEach((t) => out.addTrack(t));
    const rest = { video: askV && !useV ? c.video : false, audio: askA && !useA ? c.audio : false };
    if (rest.video || rest.audio) { const o = await origGUM(rest); o.getTracks().forEach((t) => out.addTrack(t)); }
    return out;
  };
  /* Only on sites the user allowed from the popup; the background decides, the page just asks. */
  ask("allowed").then((ok) => { enabled = !!ok; if (enabled) { try { md.dispatchEvent(new Event("devicechange")); } catch {} } }).catch(() => {});
  const keep = setInterval(() => { if (session) ask("ping").catch(() => {}); }, 20000);
  window.addEventListener("pagehide", () => { clearInterval(keep); if (session) session.stop(); });
})();
