import type { NextConfig } from "next";

function getAllowedDevOrigins() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    return [];
  }

  try {
    return [new URL(appUrl).hostname];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // Cloudflare Tunnel 讓手機以不同網域連回本機的 Next.js 開發伺服器。
  // 僅在 dev 模式允許該網址載入 _next 的開發資源。
  allowedDevOrigins: getAllowedDevOrigins(),
};

export default nextConfig;
