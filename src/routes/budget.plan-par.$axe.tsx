import { createFileRoute } from "@tanstack/react-router";
import { ListePlansGroupes, AXES_PLAN, type AxePlan } from "@/components/ListePlansGroupes";

export const Route = createFileRoute("/budget/plan-par/$axe")({
  head: () => ({
    meta: [
      { title: "Dépenses planifiées classées — Budgétisation en FCFA" },
      {
        name: "description",
        content:
          "Consultez vos dépenses planifiées classées mois par mois, enveloppe par enveloppe ou dépense par dépense, avec montants et échéances en francs CFA.",
      },
      { property: "og:title", content: "Dépenses planifiées classées — SUPER APP" },
      {
        property: "og:description",
        content: "Classement des prévisions par mois, par enveloppe ou par libellé de dépense.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PagePlanPar,
});

function PagePlanPar() {
  const { axe } = Route.useParams();
  const valide = AXES_PLAN.some((a) => a.id === axe) ? (axe as AxePlan) : "mois";
  return <ListePlansGroupes axe={valide} />;
}
