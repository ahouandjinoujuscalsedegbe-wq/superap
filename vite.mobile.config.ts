// Build SPA dédié à l'application mobile native (Capacitor / APK Android).
// Ce fichier est indépendant de vite.config.ts : il n'active ni SSR ni serveur,
// il produit uniquement des fichiers statiques dans dist-mobile/.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Chemins relatifs : indispensables dans la WebView Android (capacitor://localhost).
  base: "./",
  plugins: [tsconfigPaths(), tailwindcss(), react()],
  build: {
    outDir: "dist-mobile",
    emptyOutDir: true,
    rollupOptions: {
      input: "mobile.html",
    },
  },
});
