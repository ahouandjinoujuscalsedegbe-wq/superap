import { createFileRoute } from "@tanstack/react-router";
import { FormulaireBudget } from "@/components/FormulaireBudget";

export const Route = createFileRoute("/budget/planifier")({
  head: () => ({
    meta: [
      { title: "Planifier une dépense — Budgétisation en FCFA" },
      {
        name: "description",
        content:
          "Créez une dépense planifiée : sujet, périodicité, montant, enveloppe de prélèvement, compte débité et jour de la première échéance, en francs CFA.",
      },
      { property: "og:title", content: "Planifier une dépense — SUPER APP" },
      {
        property: "og:description",
        content: "Nouvelle prévision de dépense avec enveloppe, compte et périodicité.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <FormulaireBudget />,
});
