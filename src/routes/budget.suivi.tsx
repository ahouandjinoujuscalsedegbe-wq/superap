import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarRange } from "lucide-react";
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
      {/* Le suivi mois par mois n'était atteignable que par les Prévisions :
          il est désormais accessible depuis la page Suivi du budget. */}
      <Link
        to="/suivi"
        className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm font-medium"
      >
        <CalendarRange className="size-5 text-primary" aria-hidden="true" />
        <span>
          Suivi mois par mois
          <span className="block text-xs font-normal text-muted-foreground">
            Réel comparé à la prévision, sur plusieurs mois
          </span>
        </span>
      </Link>
    </div>
  );
}
