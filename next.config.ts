import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const lan = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => a!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: [...lan, "localhost", "*.local"],
};

export default nextConfig;
