// Zips the extension into public/ so the site can hand it out (Chrome: unzip + Load unpacked; Firefox: the .xpi).
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
mkdirSync(root + "public", { recursive: true });
rmSync(root + "public/bona-extension.zip", { force: true });
execFileSync("zip", ["-qr", "-X", root + "public/bona-extension.zip", "manifest.json", "background.js", "config.js", "content.js", "inject.js", "popup.html", "popup.js", "vendor/supabase.js"], { cwd: root + "extension" });
copyFileSync(root + "public/bona-extension.zip", root + "public/bona-extension.xpi");
console.log("packed extension → public/bona-extension.zip (+ .xpi)");
