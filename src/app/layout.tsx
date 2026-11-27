import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BRANDING } from "@/config/branding";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || BRANDING.url;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: `${BRANDING.appName} – ${BRANDING.tagline}`,
    template: `%s | ${BRANDING.appName}`,
  },
  description: BRANDING.description,
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: appUrl,
    siteName: BRANDING.appName,
    title: `${BRANDING.appName} – ${BRANDING.tagline}`,
    description: BRANDING.description,
    images: [
      {
        url: "/og-image-1200x630.png",
        width: 1200,
        height: 630,
        alt: `${BRANDING.appName} – ${BRANDING.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRANDING.appName} – ${BRANDING.tagline}`,
    description: BRANDING.description,
    images: ["/og-image-1200x630.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#111820" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-clip bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
