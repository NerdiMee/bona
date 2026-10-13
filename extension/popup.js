(async () => {
  const $ = (id) => document.getElementById(id);
  const { room, roomAt = 0, hosted = false, roomOrigin } = await chrome.storage.local.get(["room", "roomAt", "hosted", "roomOrigin"]);
  if (hosted && room && Date.now() - roomAt < 12 * 3600 * 1000) { $("dot").className = "dot on"; $("txt").textContent = "Bona room remembered"; $("sub").textContent = `Room ${room}. When your phone is live there, allowed sites can use it.`; if (roomOrigin) $("open").href = roomOrigin + "/"; }
  else try {
    const r = await fetch("http://127.0.0.1:4601/rooms", { cache: "no-store" }); const j = await r.json();
    $("open").href = `https://localhost:${j.port || 4600}/`;
    if (j.rooms && j.rooms.length) { $("dot").className = "dot on"; $("txt").textContent = "Phone live"; $("sub").textContent = `Room ${j.rooms[0].code}. Allowed sites can use it now.`; }
    else { $("dot").className = "dot wait"; $("txt").textContent = "Bona is running, no phone yet"; $("sub").textContent = "Open Bona and scan the code with your phone."; }
  } catch { $("dot").className = "dot"; $("txt").textContent = "No Bona room yet"; $("sub").textContent = "Open the Bona page in a tab and scan the code with your phone, then come back."; }
  let origin = "";
  try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); origin = tab && tab.url ? new URL(tab.url).origin : ""; } catch { origin = ""; }
  if (!/^https?:/.test(origin)) { $("site").textContent = "No website open"; $("siteNote").textContent = "Open a meeting site, then click here again."; return; }
  $("site").textContent = origin.replace(/^https?:\/\//, "");
  const render = async () => {
    const { allowed = [] } = await chrome.storage.local.get("allowed"); const on = allowed.includes(origin);
    const b = $("toggle"); b.hidden = false; b.textContent = on ? "Stop Using Bona Here" : "Allow Bona On This Site"; b.className = on ? "off" : "";
    $("siteNote").textContent = on ? "This site can pick Bona Phone Camera and Bona Phone Microphone. Reload the page once after changing this." : "Until you allow it, this site only sees your usual devices.";
  };
  $("toggle").onclick = async () => { const { allowed = [] } = await chrome.storage.local.get("allowed"); const next = allowed.includes(origin) ? allowed.filter((o) => o !== origin) : [...allowed, origin]; await chrome.storage.local.set({ allowed: next }); render(); };
  render();
})();
