import type { CapacitorConfig } from "@capacitor/cli";

// Configuration de la coque native Android.
// Les fichiers statiques proviennent du build SPA dédié (vite.mobile.config.ts → dist-mobile).
const config: CapacitorConfig = {
  appId: "com.superapp.budget",
  appName: "SUPER APP",
  webDir: "dist-mobile",
  android: {
    allowMixedContent: false,
  },
};

export default config;
