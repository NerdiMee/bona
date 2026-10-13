# Bona

Broadcast Over Network Anywhere: your phone as the webcam, over your own Wi-Fi. Bona is also Zulu for "look".

The computer shows a QR code. The phone scans it, opens a secure page served by this computer, allows the camera and the microphone once, and shows its live viewport. Pinch to zoom, drag to frame, double-tap to reset; the crop reaches the computer instantly. Video and audio travel peer to peer with WebRTC and never leave the network.

Web apps get the picture through the Bona browser extension (`extension/`, packed to `public/bona-extension.zip` and `.xpi`). On sites the user allows from the toolbar popup it offers "Bona Phone Camera" and "Bona Phone Microphone" as devices, and while a phone is live they are that site's default devices. Only the extension's background script talks to Bona, from the extension's own origin; the loopback bridge on 127.0.0.1:4601 refuses any web-page origin, pins the Host header, and the HTTPS signalling only accepts Bona's own origins. Installed desktop apps read cameras from the operating system and need a signed camera driver, which Bona does not ship; their web versions work with the extension. The clean window (`/view/clean?r=CODE`) remains for window capture.

## Two ways to run it

**Hosted (no certificate anywhere).** Bona runs at a real HTTPS address, so every phone trusts it out of the box. The handshake (offer, answer, hellos) goes through Supabase Realtime broadcast on a channel named after the room; the media is WebRTC, peer to peer on the LAN, and never touches the relay. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_KEY` (the project's public anon key; Realtime does not accept `sb_publishable` keys yet, and its presence tracker times out, which is why Bona uses broadcast heartbeats instead of presence) and deploy like any Next site.

**Offline.** `npm run dev` starts `server.mjs`, an HTTPS server on 4600 with the signalling built in. The first start writes a self-signed certificate to `certs/` (ignored by git) covering localhost and the machine's LAN addresses. Phones warn about the certificate once; `/api/cert` serves it for phones to trust. With the two env vars set, this mode also uses the hosted handshake.

```
npm install
npm run dev        # https://localhost:4600 and every LAN address
```

## Pages

- `/` the desk: QR code and room code, then the live monitor with bitrate and microphone level, Listen, Mirror, Fullscreen, Clean Window and Copy OBS Source URL.
- `/cam?r=CODE` the phone: permission gate, live viewport, finger crop, Flip, Mic, Light.
- `/view/clean?r=CODE` the output window: the picture on black for OBS or a window capture. `&mirror=1` flips it.
- `/try` a plain page that asks for a camera, to confirm the extension sees the phone.
- `/api/host` the LAN addresses used to build the code; `/api/cert` this computer's certificate for phones to trust.
- `http://127.0.0.1:4601` the loopback bridge the extension uses: `/rooms` lists rooms with a live phone, `/ws` is the same signalling.

## How it is wired

`server.mjs` runs Next behind Node's HTTPS server and relays signalling frames on `/ws`. A room is one phone and up to eight desks; each desk gets its own peer connection from the phone, so the home page and the clean window can both be live. The phone's crop is sent on a data channel as `{ s, cx, cy }` and applied as a CSS transform on each desk (`lib/crop.ts`).

Stack: Next.js 16, React 19, GSAP for the hero, Motion for state changes, D3 for the QR code, the bitrate line, the microphone arc and the path diagram.

## Check it

`npm run typecheck` and `npm run lint`. Two end-to-end checks drive real browsers with a fake camera: the desk receives 1920×1080, a pinch on the phone changes the crop on the desk, a second desk joins without dropping the first; and a browser with the extension loaded opens `/try` and receives "Bona Phone Camera" at the cropped size.
