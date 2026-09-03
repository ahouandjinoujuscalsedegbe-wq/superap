import { createFileRoute } from "@tanstack/react-router";
import { SectionBudgetAuto } from "@/components/SectionBudgetAuto";

export const Route = createFileRoute("/budget/auto")({
  head: () => ({
    meta: [
      { title: "Proposition auto — Budget mensuel calculé pour vous" },
      {
        name: "description",
        content:
          "Proposition de budget calculée à partir de vos six derniers mois de dépenses, modifiable enveloppe par enveloppe avant application.",
      },
      { property: "og:title", content: "Proposition automatique de budget — SUPER APP" },
      {
        property: "og:description",
        content: "Budget mensuel proposé automatiquement, ajustable avant validation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <SectionBudgetAuto />,
});
