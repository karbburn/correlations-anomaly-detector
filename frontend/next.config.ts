import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const backendOrigin = (
  process.env.NEXT_PUBLIC_API_URL ||
  (isDev
    ? "http://localhost:8000"
    : "https://correlations-anomaly-detector-backend.onrender.com")
).replace(/\/$/, "");

if (isDev && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn(
    `[next.config] No NEXT_PUBLIC_API_URL set — proxying to ${backendOrigin}. ` +
    `If your local FastAPI is not running there, set NEXT_PUBLIC_API_URL=http://localhost:8000.`
  );
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
