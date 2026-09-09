import { createFileRoute } from "@tanstack/react-router";
import { HistoriqueOperations } from "@/components/HistoriqueOperations";

export const Route = createFileRoute("/historique/depenses")({
  head: () => ({
    meta: [
      { title: "Historique des dépenses — Dates, heures et montants en FCFA" },
      {
        name: "description",
        content:
          "Historique complet de toutes les dépenses du foyer, avec la date et l'heure exactes de chaque opération, en francs CFA.",
      },
      { property: "og:title", content: "Historique des dépenses — SUPER APP" },
      {
        property: "og:description",
        content: "Toutes les dépenses enregistrées, avec dates et heures détaillées.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageHistoriqueDepenses,
});

function PageHistoriqueDepenses() {
  return <HistoriqueOperations type="depense" />;
}
