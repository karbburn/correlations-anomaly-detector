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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://correlations-anomaly-detector-backend.onrender.com http://localhost:8000",
              "form-action 'none'",
              "frame-ancestors 'none'",
              "base-uri 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
