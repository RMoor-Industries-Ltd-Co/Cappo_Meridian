import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build for Docker (.next/standalone).
  output: "standalone",
  images: {
    remotePatterns: [
      // Google Workspace profile photos
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
