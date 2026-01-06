// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Serina",
  description: "Multi-provider AI search + retrieval + summary",
};

// ✅ Critical for iOS: prevent Safari/WKWebView zooming on input focus
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Extra safety: explicit viewport meta (helps in some WebViews) */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
