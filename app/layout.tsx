import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://boreasexecutives.com"),
  title: {
    default: "Boreas Executives",
    template: "%s | Boreas Executives",
  },
  description:
    "Boreas Executives is an AI-powered negotiation and decision support interface inspired by Boreas, the Greek god of the north wind.",
  applicationName: "Boreas Executives",
  keywords: [
    "Boreas Executives",
    "AI negotiation",
    "procurement simulation",
    "industrial buyer",
    "frozen fruit",
    "IQF strawberries",
    "B2B negotiation",
  ],
  authors: [{ name: "Boreas Executives" }],
  creator: "Boreas Executives",
  publisher: "Boreas Executives",
  icons: {
    icon: "/boreas-executives-logo.png",
    shortcut: "/boreas-executives-logo.png",
    apple: "/boreas-executives-logo.png",
  },
  openGraph: {
    title: "Boreas Executives",
    description:
      "AI-powered negotiation and decision support inspired by Boreas, the Greek god of the north wind.",
    url: "https://boreasexecutives.com",
    siteName: "Boreas Executives",
    images: [
      {
        url: "/boreas-executives-logo.png",
        width: 1200,
        height: 630,
        alt: "Boreas Executives",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Boreas Executives",
    description:
      "AI-powered negotiation and decision support inspired by Boreas, the Greek god of the north wind.",
    images: ["/boreas-executives-logo.png"],
  },
};

export const viewport: Viewport = {
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "hsl(0 0% 100%)" },
    { media: "(prefers-color-scheme: dark)", color: "hsl(240deg 10% 3.92%)" },
  ],
};

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

const LIGHT_THEME_COLOR = "hsl(0 0% 100%)";
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geist.variable} ${geistMono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          enableSystem={false}
        >
          <SessionProvider
            basePath={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/auth`}
          >
            <TooltipProvider>{children}</TooltipProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}