import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CorrShift — Cross-Asset Correlation Anomaly Detector",
    short_name: "CorrShift",
    description:
      "Real-time cross-asset correlation intelligence for Indian markets — NIFTY 50, USD/INR, Gold, Crude, 10Y G-Sec & FII flows. By Sourabh Pradhan.",
    start_url: "/",
    display: "standalone",
    background_color: "#060d0a",
    theme_color: "#060d0a",
    icons: [
      {
        src: "/icon.png",
        sizes: "2048x2048",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    lang: "en-IN",
    orientation: "any",
    categories: ["finance", "business", "utilities"],
    shortcuts: [
      {
        name: "View Methodology",
        url: "/#methodology",
        description: "Learn how rolling correlations and z-score detection work",
      },
    ],
    related_applications: [],
    prefer_related_applications: false,
  };
}
