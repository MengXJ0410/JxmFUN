import type { NextConfig } from "next";

const privateHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Vary", value: "Cookie" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  async headers() {
    return [
      { source: "/", headers: privateHeaders },
      { source: "/gate", headers: privateHeaders },
      { source: "/backgrounds", headers: privateHeaders },
    ];
  },
};

export default nextConfig;
