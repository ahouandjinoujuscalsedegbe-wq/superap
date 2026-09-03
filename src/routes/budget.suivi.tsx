import { createFileRoute } from "@tanstack/react-router";
import { FicheSuiviBudget } from "@/components/FicheSuiviBudget";
import { SuiviPlanifieReel } from "@/components/SuiviPlanifieReel";

export const Route = createFileRoute("/budget/suivi")({
  head: () => ({
    meta: [
      { title: "Suivi du mois — Budget prévu et dépenses réelles" },
      {
        name: "description",
        content:
          "Comparez, enveloppe par enveloppe, le budget prévu du mois et les dépenses réellement effectuées en francs CFA.",
      },
      { property: "og:title", content: "Suivi du budget du mois — SUPER APP" },
      {
        property: "og:description",
        content: "Comparaison du budget prévu et des dépenses réelles de chaque enveloppe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageSuivBudget,
});

function PageSuivBudget() {
  return (
    <div className="space-y-6">
      <SuiviPlanifieReel />
      <FicheSuiviBudget />
    </div>
  );
}
