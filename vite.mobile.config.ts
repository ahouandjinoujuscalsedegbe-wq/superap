// Build SPA dédié à l'application mobile native (Capacitor / APK Android).
// Ce fichier est indépendant de vite.config.ts : il n'active ni SSR ni serveur,
// il produit uniquement des fichiers statiques dans dist-mobile/.
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { renameSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Capacitor ouvre toujours `index.html`. Le build part de `mobile.html`,
 * on le renomme donc en `index.html` à la fin de la compilation.
 */
function renommerEnIndex(): Plugin {
  return {
    name: "renommer-mobile-en-index",
    closeBundle() {
      const dossier = resolve(process.cwd(), "dist-mobile");
      const source = resolve(dossier, "mobile.html");
      if (existsSync(source)) renameSync(source, resolve(dossier, "index.html"));
    },
  };
}

export default defineConfig({
  // Chemins relatifs : indispensables dans la WebView Android (capacitor://localhost).
  base: "./",
  // Indique au composant racine de ne pas recréer <html>/<body> : dans la
  // WebView, React est monté dans le <div id="root"> de index.html.
  define: { "import.meta.env.VITE_COQUE_MOBILE": "true" },
  plugins: [tsconfigPaths(), tailwindcss(), react(), renommerEnIndex()],
  build: {
    outDir: "dist-mobile",
    emptyOutDir: true,
    rollupOptions: {
      input: "mobile.html",
    },
  },
});
