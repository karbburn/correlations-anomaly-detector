import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://corrshift.sourabhpradhan.in";
const PORTFOLIO_URL = "https://www.sourabhpradhan.in";
const SITE_NAME = "CorrShift";
const OG_IMAGE = "/icon.png";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#060d0a" },
    { media: "(prefers-color-scheme: light)", color: "#f5f0e8" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "CorrShift",
  title: {
    default: "CorrShift — Cross-Asset Correlation Anomaly Detector | Indian Markets",
    template: "%s | CorrShift",
  },
  description:
    "Real-time cross-asset correlation intelligence for Indian markets. Monitor rolling correlations, z-score regime shifts & anomaly alerts across NIFTY 50, USD/INR, Gold, Crude, 10Y G-Sec & FII flows.",
  keywords: [
    "CorrShift",
    "cross-asset correlation",
    "correlation anomaly detection",
    "Indian stock market",
    "NIFTY 50 correlation",
    "portfolio risk management",
    "regime shift detection",
    "z-score anomaly",
    "rolling correlation matrix",
    "FII flows",
    "G-Sec yield",
    "quantitative finance India",
    "risk analytics",
    "statistical arbitrage",
    "correlation breakdown",
    "Sourabh Pradhan",
  ],
  authors: [{ name: "Sourabh Pradhan", url: PORTFOLIO_URL }],
  creator: "Sourabh Pradhan",
  publisher: "Sourabh Pradhan",
  category: "Finance",
  classification: "Quantitative Finance — Cross-Asset Risk Analytics",
  referrer: "strict-origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  generator: "Next.js",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "CorrShift — Cross-Asset Correlation Anomaly Detector",
    description:
      "Rolling correlation matrices, z-score regime detection and anomaly alerts across NIFTY 50, USD/INR, Gold, Crude, 10Y G-Sec and FII flows. Live daily updates for Indian macro portfolios.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: OG_IMAGE,
        width: 2048,
        height: 2048,
        alt: "CorrShift — Cross-Asset Correlation Anomaly Detector",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CorrShift — Cross-Asset Correlation Anomaly Detector",
    description:
      "Rolling correlation matrices, z-score regime detection and anomaly alerts across Indian market assets. Built for portfolio managers & risk analysts.",
    images: [OG_IMAGE],
    creator: "@sourabhpradhan",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  manifest: "/manifest.webmanifest",
  archives: [PORTFOLIO_URL],
  assets: [SITE_URL],
  bookmarks: [SITE_URL],
  other: {
    "geo.region": "IN",
    "geo.placename": "India",
  },
};

// JSON-LD structured data for SEO + GEO (Generative Engine Optimization)
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "CorrShift",
      description:
        "Real-time cross-asset correlation anomaly detector for Indian financial markets. Monitor rolling correlations and detect regime shifts across NIFTY 50, USD/INR, Gold, Crude, 10Y G-Sec and FII flows.",
      inLanguage: "en-IN",
      publisher: { "@id": `${SITE_URL}/#organization` },
      author: { "@id": `${PORTFOLIO_URL}/#person` },
      isPartOf: { "@id": `${PORTFOLIO_URL}/#website` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/?pair={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "CorrShift",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "Cross-asset correlation intelligence platform that computes rolling Pearson correlations, z-score anomaly detection and regime classification across 6 Indian market assets (15 pairs) with 30D/60D/252D windows.",
      author: { "@id": `${PORTFOLIO_URL}/#person` },
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      featureList: [
        "6-asset rolling Pearson correlation matrices",
        "Z-score anomaly detection (±2σ default, 1.0–3.5 configurable)",
        "30-day / 60-day / 252-day windows",
        "Regime classification (anomaly, strong/mild positive, neutral, mild/strong negative)",
        "Interactive D3 heatmap and Recharts drilldown",
        "Regime timeline heat calendar",
        "Paginated anomaly feed with CSV/XLSX export",
        "Shareable URL state and methodology modal",
      ],
      screenshot: `${SITE_URL}/icon.png`,
      softwareVersion: "1.0",
      isAccessibleForFree: true,
      keywords:
        "correlation anomaly, NIFTY50, USDINR, gold, crude oil, G-Sec, FII flow, Indian markets, quantitative finance",
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "CorrShift",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.png`,
        width: 2048,
        height: 2048,
      },
      founder: { "@id": `${PORTFOLIO_URL}/#person` },
      sameAs: [PORTFOLIO_URL, "https://www.linkedin.com/in/sourabh-pradhan07/"],
    },
    {
      "@type": "Person",
      "@id": `${PORTFOLIO_URL}/#person`,
      name: "Sourabh Pradhan",
      url: PORTFOLIO_URL,
      sameAs: ["https://www.linkedin.com/in/sourabh-pradhan07/", PORTFOLIO_URL],
      jobTitle: "Quantitative Developer",
      knowsAbout: [
        "Quantitative Finance",
        "Cross-Asset Correlations",
        "Risk Analytics",
        "Indian Financial Markets",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What is CorrShift?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "CorrShift is a real-time cross-asset correlation anomaly detector for Indian markets. It monitors rolling Pearson correlations across NIFTY 50, USD/INR, Gold, Brent Crude, 10Y G-Sec Yield and FII Net Flow, and flags statistically significant regime shifts using rolling z-scores.",
          },
        },
        {
          "@type": "Question",
          name: "How does CorrShift detect correlation anomalies?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Each of the 15 asset pairs has its rolling correlation (30D/60D/252D window) converted to a rolling z-score: z = (ρ_t − μ_252) / σ_252, where μ and σ are the 252-day rolling mean and standard deviation. An anomaly is flagged when |z| exceeds a configurable threshold (default 2.0σ), with z-scores clipped to ±10.",
          },
        },
        {
          "@type": "Question",
          name: "What data sources does CorrShift use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "NIFTY 50 (^NSEI), USD/INR (INR=X), Gold (GOLDBEES.NS) and Brent Crude (BZ=F) via yfinance; 10Y G-Sec yield via FBIL API; and FII Net Flow via NSE India. Data is aligned on the NIFTY trading calendar with forward-fill, validated for >20% missing, and cached in-memory and as Parquet with hourly refresh.",
          },
        },
        {
          "@type": "Question",
          name: "Who is CorrShift built for?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Portfolio managers, risk analysts and quantitative researchers who rely on cross-asset correlations for hedging, portfolio construction and risk budgeting in Indian macro portfolios. It is an anomaly detection layer — not a trading signal generator.",
          },
        },
        {
          "@type": "Question",
          name: "Is CorrShift free to use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. CorrShift is free and open. The dashboard is publicly accessible at https://corrshift.sourabhpradhan.in and the methodology is fully documented.",
          },
        },
      ],
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${SITE_URL}/#breadcrumbs`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Sourabh Pradhan Portfolio",
          item: PORTFOLIO_URL,
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-IN"
      className={`${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="canonical" href={SITE_URL} />
        <link rel="author" href={PORTFOLIO_URL} />
        <meta name="author" content="Sourabh Pradhan" />
        <meta name="creator" content="Sourabh Pradhan" />
        <meta name="publisher" content="Sourabh Pradhan" />
        {/* GEO: Explicit AI-readable site description */}
        <meta
          name="ai:description"
          content="CorrShift is a cross-asset correlation anomaly detector for Indian markets by Sourabh Pradhan (sourabhpradhan.in). It tracks rolling correlations and z-score regime shifts across NIFTY 50, USD/INR, Gold, Crude, 10Y G-Sec and FII flows."
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.remove('dark');else document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground font-[family-name:var(--font-mono)]">
        {children}
      </body>
    </html>
  );
}
