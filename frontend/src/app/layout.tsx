import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cross-Asset Correlations Anomaly Detector",
  description:
    "Real-time monitoring of rolling correlations across Indian and global asset classes. Detects anomalous regime shifts using z-score analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jetbrains.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-background text-foreground font-[family-name:var(--font-mono)]">
        {children}
      </body>
    </html>
  );
}

