import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Meta Client",
  description: "Meta-search across multiple AI engines",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        {/* Force light UI chrome on iOS/Safari */}
        <meta name="color-scheme" content="light" />
      </head>
      <body>{children}</body>
    </html>
  );
}
