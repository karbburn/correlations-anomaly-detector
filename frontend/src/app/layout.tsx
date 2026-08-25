import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://corrshift.vercel.app"),
  title: "CorrShift — Cross-Asset Correlation Anomaly Detector",
  description:
    "Real-time platform for monitoring rolling cross-asset correlations and detecting anomalous market regime shifts using statistical signal detection.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "CorrShift — Cross-Asset Correlation Anomaly Detector",
    description:
      "Rolling correlation matrices, z-score regime detection and anomaly alerts across NIFTY 50, USD/INR, gold, crude, 10Y G-Sec and FII flows.",
    url: "/",
    siteName: "CorrShift",
    type: "website",
    images: [
      {
        url: "/icon.png",
        width: 2048,
        height: 2048,
        alt: "CorrShift",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "CorrShift — Cross-Asset Correlation Anomaly Detector",
    description:
      "Rolling correlation matrices, z-score regime detection and anomaly alerts across Indian market assets.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
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
