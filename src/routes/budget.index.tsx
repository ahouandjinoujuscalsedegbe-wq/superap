import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarRange, ListChecks, Sparkles } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { equivalentMensuel } from "@/lib/periodes";

export const Route = createFileRoute("/budget/")({
  head: () => ({
    meta: [
      { title: "Budgétisation — Toutes vos fonctions de budget en FCFA" },
      {
        name: "description",
        content:
          "Onglet Budgétisation : plan des dépenses prévues, suivi du budget du mois et proposition automatique adaptée à vos habitudes, en francs CFA.",
      },
      { property: "og:title", content: "Budgétisation — SUPER APP" },
      {
        property: "og:description",
        content: "Plan des dépenses, suivi mensuel et proposition automatique de budget.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BudgetAccueil,
});

const ENTREES = [
  {
    to: "/budget/plan",
    icone: CalendarRange,
    titre: "Plan des dépenses",
    texte: "Planifier une dépense, voir les échéances et les convertir en dépenses réelles.",
  },
  {
    to: "/budget/suivi",
    icone: ListChecks,
    titre: "Suivi du mois",
    texte: "Comparer le budget prévu et les dépenses réelles de chaque enveloppe.",
  },
  {
    to: "/budget/auto",
    icone: Sparkles,
    titre: "Proposition auto",
    texte: "Budget proposé par l'intelligence de l'application, modifiable avant application.",
  },
] as const;

function BudgetAccueil() {
  const { budgets } = useSuperApp();
  const totalMensuel = budgets.reduce((s, b) => s + equivalentMensuel(b), 0);
  const totalPlanifie = budgets.reduce((s, b) => s + b.montant, 0);

  return (
    <div className="space-y-4">
      <section className="carte space-y-1 p-4">
        <p className="text-sm font-semibold">Total planifié : {formatFCFA(totalPlanifie)}</p>
        <p className="text-xs text-muted-foreground">
          Équivalent mensuel de tout le plan : {formatFCFA(totalMensuel)}
        </p>
      </section>

      <nav className="space-y-2">
        {ENTREES.map((e) => (
          <Link
            key={e.to}
            to={e.to}
            className="carte flex items-start gap-3 p-4 active:scale-[0.99]"
          >
            <e.icone className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{e.titre}</span>
              <span className="block text-xs text-muted-foreground">{e.texte}</span>
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
