/* LAN only: host candidates are enough, and no address is sent to any outside STUN server. */
export const rtcConfig: RTCConfiguration = { iceServers: [], iceCandidatePoolSize: 2 };

/* Candidates can arrive before the remote description is set; keep them until it is. */
export class CandidateQueue {
  private q: RTCIceCandidateInit[] = [];
  private ready = false;
  constructor(private pc: RTCPeerConnection) {}
  async push(c: RTCIceCandidateInit) { if (this.ready) await this.pc.addIceCandidate(c).catch(() => {}); else this.q.push(c); }
  async flush() { this.ready = true; for (const c of this.q.splice(0)) await this.pc.addIceCandidate(c).catch(() => {}); }
}

export type Stats = { fps: number; kbps: number; rtt: number; w: number; h: number };

/* What ICE is doing, in words: which candidates each side offered and whether any pair got through. */
export async function describeIce(pc: RTCPeerConnection): Promise<string> {
  const report = await pc.getStats();
  const local: string[] = [], remote: string[] = []; let pairs = 0, ok = 0;
  report.forEach((r) => {
    if (r.type === "local-candidate") local.push(r.candidateType + (r.address && String(r.address).endsWith(".local") ? " (mDNS)" : ""));
    if (r.type === "remote-candidate") remote.push(r.candidateType + (r.address && String(r.address).endsWith(".local") ? " (mDNS)" : ""));
    if (r.type === "candidate-pair") { pairs++; if (r.state === "succeeded") ok++; }
  });
  const list = (a: string[]) => (a.length ? a.join(", ") : "none yet");
  return `ICE ${pc.iceConnectionState} · this computer: ${list(local)} · phone: ${list(remote)} · pairs ${ok}/${pairs} succeeded`;
}
export async function readStats(pc: RTCPeerConnection, prev: { bytes: number; t: number }): Promise<{ stats: Stats; prev: { bytes: number; t: number } }> {
  const report = await pc.getStats();
  let fps = 0, bytes = prev.bytes, rtt = 0, w = 0, h = 0;
  report.forEach((r) => {
    if (r.type === "inbound-rtp" && r.kind === "video") { fps = r.framesPerSecond ?? 0; bytes = r.bytesReceived ?? bytes; w = r.frameWidth ?? 0; h = r.frameHeight ?? 0; }
    if (r.type === "candidate-pair" && r.nominated && r.currentRoundTripTime != null) rtt = r.currentRoundTripTime * 1000;
  });
  const t = performance.now(), dt = Math.max(1, t - prev.t) / 1000;
  return { stats: { fps, kbps: Math.max(0, ((bytes - prev.bytes) * 8) / 1000 / dt), rtt, w, h }, prev: { bytes, t } };
}

/* Host-only gathering finishes in milliseconds, so one complete description replaces a trickle of candidates
 * (kinder to the relay, and fewer round trips). */
export async function gathered(pc: RTCPeerConnection, ms = 1500): Promise<RTCSessionDescriptionInit | null> {
  if (pc.iceGatheringState !== "complete") await new Promise<void>((r) => { const t = setTimeout(r, ms); pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(t); r(); } }); });
  return pc.localDescription ? pc.localDescription.toJSON() : null;
}
