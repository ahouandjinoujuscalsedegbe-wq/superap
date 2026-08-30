import type { CapacitorConfig } from "@capacitor/cli";

// Configuration de la coque native Android.
// Les fichiers statiques proviennent du build SPA dédié (vite.mobile.config.ts → dist-mobile).
const config: CapacitorConfig = {
  appId: "com.superapp.budget",
  appName: "SUPER APP",
  webDir: "dist-mobile",
  // Schéma « https » : la WebView est alors un contexte sécurisé, indispensable
  // au chiffrement (crypto.subtle) utilisé par le code PIN et les sauvegardes.
  server: { androidScheme: "https" },
  android: {
    allowMixedContent: false,
    // Permet de brancher le téléphone en USB et d'inspecter l'application
    // depuis chrome://inspect si un problème persiste.
    webContentsDebuggingEnabled: true,
  },
};

export default config;
