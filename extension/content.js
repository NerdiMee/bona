/* Bona Phone Camera · bridge between the page (inject.js) and the background, over postMessage.
 * Only messages from this very window are relayed, and the background re-checks the site's permission itself.
 * On the Bona site itself it also remembers the room code, so the extension knows which phone is yours. */
(() => {
  if (window.__bonaBridge) return; window.__bonaBridge = true;
  const CH = "bona-phone-camera"; let port = null;
  const connect = () => { port = chrome.runtime.connect({ name: "bona" }); port.onMessage.addListener((m) => window.postMessage({ [CH]: "res", m }, "*")); port.onDisconnect.addListener(() => { port = null; window.postMessage({ [CH]: "res", m: { wsClosed: true } }, "*"); }); };
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data[CH] !== "req") return;
    try { if (!port) connect(); port.postMessage(e.data.m); } catch { window.postMessage({ [CH]: "res", m: { res: e.data.m && e.data.m.id, ok: false, error: "Bona extension needs a reload." } }, "*"); }
  });
  const remember = () => { const r = document.documentElement.dataset.bonaRoom; if (r && /^[a-z0-9]{6,12}$/i.test(r)) chrome.storage.local.set({ room: r, roomOrigin: location.origin, roomAt: Date.now(), hosted: document.documentElement.dataset.bonaHosted === "1" }); };
  new MutationObserver(remember).observe(document.documentElement, { attributes: true, attributeFilter: ["data-bona-room", "data-bona-hosted"] });
  remember();
})();
