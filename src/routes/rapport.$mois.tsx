import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { BoutonRetour } from "@/components/BoutonRetour";
import { RapportMensuelVue } from "@/components/RapportMensuelVue";
import { UtilisationQuotidienneEnveloppes } from "@/components/UtilisationQuotidienneEnveloppes";
import { useSuperApp } from "@/lib/store";
import { construireRapport } from "@/lib/rapport-mensuel";

export const Route = createFileRoute("/rapport/$mois")({
  head: () => ({
    meta: [
      { title: "Rapport du mois — SUPER APP" },
      {
        name: "description",
        content:
          "Bilan complet d'un mois : revenus, dépenses, taux d'épargne, enveloppes dépassées, retards et conseils.",
      },
      { property: "og:title", content: "Rapport du mois" },
      {
        property: "og:description",
        content: "Le bilan détaillé du mois choisi, calculé sur votre téléphone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageRapportMois,
});

function PageRapportMois() {
  const { mois } = Route.useParams();
  const { transactions, enveloppes, dettes, budgets } = useSuperApp();

  const rapport = useMemo(
    () => construireRapport(mois, { transactions, enveloppes, dettes, budgets }),
    [mois, transactions, enveloppes, dettes, budgets],
  );

  return (
    <div className="space-y-4 pb-28 pt-4">
      <BoutonRetour to="/rapport" label="Tous les mois" />
      <RapportMensuelVue rapport={rapport} />
      <UtilisationQuotidienneEnveloppes mois={mois} />
    </div>
  );
}
