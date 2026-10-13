// Self-signed certificate for the LAN. Regenerated when the machine's addresses change.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import selfsigned from "selfsigned";

const dir = join(process.cwd(), "certs");
const files = { key: join(dir, "key.pem"), cert: join(dir, "cert.pem"), meta: join(dir, "meta.json") };

export async function ensureCerts(ips) {
  const wanted = JSON.stringify([...ips].sort());
  if (existsSync(files.key) && existsSync(files.cert) && existsSync(files.meta) && readFileSync(files.meta, "utf8") === wanted) {
    return { key: readFileSync(files.key), cert: readFileSync(files.cert) };
  }
  const altNames = [{ type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }, ...ips.map((ip) => ({ type: 7, ip }))];
  const pems = await selfsigned.generate([{ name: "commonName", value: "bona.local" }], {
    days: 3650, keySize: 2048, algorithm: "sha256",
    extensions: [{ name: "basicConstraints", cA: true }, { name: "keyUsage", digitalSignature: true, keyEncipherment: true, keyCertSign: true }, { name: "extKeyUsage", serverAuth: true }, { name: "subjectAltName", altNames }],
  });
  mkdirSync(dir, { recursive: true });
  writeFileSync(files.key, pems.private, { mode: 0o600 }); writeFileSync(files.cert, pems.cert); writeFileSync(files.meta, wanted);
  return { key: pems.private, cert: pems.cert };
}
