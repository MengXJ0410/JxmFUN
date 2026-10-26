import type { NextConfig } from "next";

const privateHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Vary", value: "Cookie" },
];

const live2dHeaders = [
  { key: "Cache-Control", value: "public, max-age=604800" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  async headers() {
    return [
      { source: "/", headers: privateHeaders },
      { source: "/gate", headers: privateHeaders },
      { source: "/backgrounds", headers: privateHeaders },
      { source: "/live2d/:path*", headers: live2dHeaders },
      {
        // 图标文件由用户随时替换，不能沿用 7 天缓存
        source: "/live2d/ui/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/live2d/hiro/hiro.moc3",
        headers: [
          ...live2dHeaders,
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
