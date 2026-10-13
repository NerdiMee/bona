import { networkInterfaces } from "node:os";

export const dynamic = "force-dynamic";

/* The LAN addresses the phone can reach this computer on. Used to build the QR. */
export function GET(req: Request) {
  const url = new URL(req.url);
  const ips = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => a!.address);
  return Response.json({ ips, port: url.port || (url.protocol === "https:" ? "443" : "80") });
}
