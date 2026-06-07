import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build for Docker (.next/standalone).
  output: "standalone",
  images: {
    // Serve brand assets / avatars as-is — no server-side optimizer (avoids the
    // sharp native dependency in the Alpine container; fixed-size assets anyway).
    unoptimized: true,
    remotePatterns: [
      // Google Workspace profile photos
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
