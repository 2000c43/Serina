// src/app/CapacitorBoot.tsx
"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

export default function CapacitorBoot() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      try {
        // ✅ Force non-overlay (status bar will NOT sit on top of the webview)
        await StatusBar.setOverlaysWebView({ overlay: false });

        // Optional: If your header background is light, this makes status text dark.
        await StatusBar.setStyle({ style: Style.Dark });

        // ✅ Some versions return extra fields (like height) that aren't in the TS type
        const info = (await StatusBar.getInfo()) as unknown as { height?: number };

        const h = typeof info?.height === "number" ? info.height : 0;
        document.documentElement.style.setProperty("--native-statusbar-h", `${h}px`);
      } catch (e) {
        console.warn("StatusBar setup failed:", e);
      }
    })();
  }, []);

  return null;
}
