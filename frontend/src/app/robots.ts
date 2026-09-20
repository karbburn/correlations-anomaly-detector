import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = "https://corrshift.sourabhpradhan.in";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
      // GEO: explicitly allow major AI crawlers / LLM bots
      {
        userAgent: ["GPTBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "CCBot", "anthropic-ai", "cohere-ai"],
        allow: "/",
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
