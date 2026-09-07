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
    // Android 15 impose l'affichage bord à bord. Capacitor rétablit ici les
    // marges système afin qu'aucun contrôle ne passe sous les barres du téléphone.
    adjustMarginsForEdgeToEdge: "auto",
    // Désactivé en production : une WebView débogable dans un APK distribué
    // peut renforcer les alertes de sécurité Android / Play Protect.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // Écran de démarrage aux couleurs du logo (rose clair).
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#ffe4ee",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
  },
};

export default config;
