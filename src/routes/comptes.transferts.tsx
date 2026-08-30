import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/comptes/transferts")({
  head: () => ({
    meta: [
      { title: "Transferts entre comptes — SUPER APP" },
      {
        name: "description",
        content:
          "Déplacez de l'argent entre vos comptes en FCFA et consultez l'historique des transferts du foyer.",
      },
      { property: "og:title", content: "Transferts entre comptes — SUPER APP" },
      {
        property: "og:description",
        content:
          "Déplacez de l'argent entre vos comptes en FCFA et consultez l'historique des transferts du foyer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Outlet />,
});
