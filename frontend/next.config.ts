import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const backendOrigin = (
  process.env.NEXT_PUBLIC_API_URL ||
  (isDev
    ? "http://localhost:8000"
    : "https://correlations-anomaly-detector.onrender.com")
).replace(/\/$/, "");

// Allow both legacy and current Render hosts in CSP (proxy may point to either)
const cspConnectSrc = `connect-src 'self' ${backendOrigin} https://correlations-anomaly-detector.onrender.com https://correlations-anomaly-detector-backend.onrender.com`;

if (isDev && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn(
    `[next.config] No NEXT_PUBLIC_API_URL set — proxying to ${backendOrigin}. ` +
    `If your local FastAPI is not running there, set NEXT_PUBLIC_API_URL=http://localhost:8000.`
  );
}

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      // GEO: enforce canonical host consistency if ever served on vercel legacy
      {
        source: "/:path*",
        has: [{ type: "host", value: "corrshift.vercel.app" }],
        destination: "https://corrshift.sourabhpradhan.in/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // SEO: allow indexing, canonical is set via metadata + link tag
          { key: "X-Robots-Tag", value: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // unsafe-eval is only needed for React Refresh in development.
              `script-src 'self'${isDev ? " 'unsafe-eval'" : ""} 'unsafe-inline'`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://corrshift.sourabhpradhan.in https://sourabhpradhan.in",
              "font-src 'self' data:",
              cspConnectSrc,
              "form-action 'none'",
              "frame-ancestors 'self' https://corrshift.sourabhpradhan.in https://www.sourabhpradhan.in https://sourabhpradhan.in",
              "base-uri 'none'",
            ].join("; "),
          },
        ],
      },
      {
        // Cache static assets aggressively; keep HTML fresh for SEO
        source: "/:all*(svg|png|jpg|jpeg|webp|avif|ico|woff2)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
