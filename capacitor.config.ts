import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.c2000c43.serina.dev01",
  appName: "Serina",
  webDir: "public",
  server: {
    url: "https://serina-ten.vercel.app",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    // ✅ This is the key: stop the WebView from allowing zoom
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
  plugins: {
    // ✅ Capacitor iOS WebView config
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
