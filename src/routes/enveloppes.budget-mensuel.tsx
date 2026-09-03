import { createFileRoute, Navigate } from "@tanstack/react-router";

/**
 * Ancienne page « Budget mensuel » : le suivi est désormais un onglet de la
 * page unique Budget (/budget). On redirige pour ne casser
 * aucun ancien lien.
 */
export const Route = createFileRoute("/enveloppes/budget-mensuel")({
  head: () => ({
    meta: [
      { title: "Budget mensuel — redirection vers la page Budget" },
      {
        name: "description",
        content:
          "Le suivi du budget mensuel des enveloppes est maintenant intégré à la page Budget de SUPER APP.",
      },
      { property: "og:title", content: "Budget mensuel — SUPER APP" },
      {
        property: "og:description",
        content: "Le suivi mensuel des enveloppes se trouve désormais dans la page Budget.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Navigate to="/budget" replace />,
});
