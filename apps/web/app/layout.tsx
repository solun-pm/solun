import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

const siteUrl = "https://solun.pm";
const siteTitle = "Solun • Privacy at its highest";
const siteDescription =
  "Privacy-first paste and file sharing with end-to-end encryption, burn-after-read, and strict expirations.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s · Solun"
  },
  description: siteDescription,
  applicationName: "Solun",
  keywords: [
    "pastebin",
    "secure paste",
    "private paste",
    "encrypted paste",
    "burn after read",
    "self-destructing message",
    "secure file sharing",
    "end-to-end encryption",
    "privacy-first"
  ],
  alternates: {
    canonical: siteUrl
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1
    }
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: "Solun",
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription
  },
  icons: {
    icon: "/favicon.ico"
  },
  category: "security",
  referrer: "strict-origin-when-cross-origin",
  creator: "Solun",
  publisher: "Solun"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
