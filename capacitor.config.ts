import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.c2000c43.serina',
  appName: 'Serina',
  webDir: 'public',
  server: {
    url: 'https://serina-ten.vercel.app',
    cleartext: false
  }
};

export default config;
