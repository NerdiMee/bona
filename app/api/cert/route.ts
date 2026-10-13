import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

/* This computer's own certificate, so a phone can trust it once instead of accepting a warning every time. */
export function GET() {
  try {
    const pem = readFileSync(join(process.cwd(), "certs", "cert.pem"));
    return new Response(pem, { headers: { "Content-Type": "application/x-x509-ca-cert", "Content-Disposition": 'attachment; filename="bona-certificate.crt"' } });
  } catch { return new Response("No certificate yet", { status: 404 }); }
}
