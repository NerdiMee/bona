import type { Metadata, Viewport } from "next";
import { Inter_Tight, Inter } from "next/font/google";
import "./globals.css";

const display = Inter_Tight({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap" });
const body = Inter({ variable: "--font-body", subsets: ["latin"], weight: "variable", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Bona · Your Phone Is The Camera", template: "%s · Bona" },
  description: "Bona, Broadcast Over Network Anywhere: scan a code, allow the camera, and your phone becomes a webcam with audio for this computer over your own Wi-Fi. Crop the shot with your fingers and use it in Meet, Zoom, Teams and Discord on the web.",
  applicationName: "Bona",
};
export const viewport: Viewport = { themeColor: "#ececec", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
