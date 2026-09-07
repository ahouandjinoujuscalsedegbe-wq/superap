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
  // TanStack Start contient un accès serveur à node:async_hooks. Vite le
  // remplace sinon par un objet vide dans la WebView, puis le paquet plante
  // avant le premier rendu avec « AsyncLocalStorage is not a constructor ».
  resolve: {
    alias: {
      "node:async_hooks": resolve(process.cwd(), "src/lib/async-hooks-mobile.ts"),
    },
  },
  plugins: [tsconfigPaths(), tailwindcss(), react(), renommerEnIndex()],
  build: {
    // Cible volontairement large : les WebView Android livrées sur des
    // téléphones plus anciens ne comprennent pas la syntaxe la plus récente.
    target: ["es2017", "chrome80", "safari13"],
    outDir: "dist-mobile",
    emptyOutDir: true,
    // Un seul fichier JavaScript d'un mégaoctet ralentit le démarrage de la
    // WebView. On sépare les grosses bibliothèques du code de l'application :
    // le navigateur les met en cache une fois pour toutes.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: "mobile.html",
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-dom") || /node_modules\/react\//.test(id)) return "react";
          if (id.includes("@tanstack")) return "routeur";
          if (id.includes("lucide-react")) return "icones";
          return "librairies";
        },
      },
    },
  },
});
