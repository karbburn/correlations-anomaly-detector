import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

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
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-[#060a14] text-slate-200 font-[family-name:var(--font-inter)]">
        {children}
      </body>
    </html>
  );
}
