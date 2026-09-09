import { createFileRoute } from "@tanstack/react-router";
import { HistoriqueOperations } from "@/components/HistoriqueOperations";

export const Route = createFileRoute("/historique/revenus")({
  head: () => ({
    meta: [
      { title: "Historique des revenus — Dates, heures et montants en FCFA" },
      {
        name: "description",
        content:
          "Historique complet de tous les revenus du foyer, avec la date et l'heure exactes de chaque opération, en francs CFA.",
      },
      { property: "og:title", content: "Historique des revenus — SUPER APP" },
      {
        property: "og:description",
        content: "Tous les revenus enregistrés, avec dates et heures détaillées.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageHistoriqueRevenus,
});

function PageHistoriqueRevenus() {
  return <HistoriqueOperations type="revenu" />;
}
