import type { NextConfig } from "next";

const backendOrigin = (process.env.NEXT_PUBLIC_API_URL || "https://correlations-anomaly-detector-backend.onrender.com").replace(/\/$/, "");

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
