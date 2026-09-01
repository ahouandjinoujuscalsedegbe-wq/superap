import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import {
  construireRapport,
  libelleMois,
  moisDisponibles,
} from "@/lib/rapport-mensuel";

export const Route = createFileRoute("/rapport/")({
  head: () => ({
    meta: [
      { title: "Rapports mensuels — SUPER APP" },
      {
        name: "description",
        content:
          "Choisissez un mois et consultez son rapport complet : revenus, dépenses, épargne et conseils, calculés hors ligne.",
      },
      { property: "og:title", content: "Rapports mensuels" },
      {
        property: "og:description",
        content: "Tous les mois de votre foyer, chacun avec son propre bilan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageListeRapports,
});

function PageListeRapports() {
  const { transactions, enveloppes, dettes, budgets } = useSuperApp();
  const mois = useMemo(() => moisDisponibles(transactions), [transactions]);

  const resumes = useMemo(
    () =>
      mois.map((m) => {
        const r = construireRapport(m, { transactions, enveloppes, dettes, budgets });
        return {
          mois: m,
          revenus: r.revenus,
          depenses: r.depenses,
          net: r.net,
          score: r.score,
          nbOperations: r.nbOperations,
        };
      }),
    [mois, transactions, enveloppes, dettes, budgets],
  );

  return (
    <div className="space-y-4 pt-4">
      <BoutonRetour to="/" label="Accueil" />

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileText className="h-6 w-6 text-primary" aria-hidden />
          Rapports mensuels
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque mois a son rapport indépendant. Choisissez un mois pour l'ouvrir.
        </p>
      </header>

      <ul className="space-y-2">
        {resumes.map((r) => (
          <li key={r.mois}>
            <Link
              to="/rapport/$mois"
              params={{ mois: r.mois }}
              className="carte flex items-center gap-3 p-4 active:opacity-80"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold capitalize">
                  {libelleMois(r.mois)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.nbOperations} opérations · note {r.score}/100
                </p>
                <p className="mt-1 text-xs">
                  <span className="text-success">{formatFCFA(r.revenus)}</span>
                  {" · "}
                  <span className="text-destructive">{formatFCFA(r.depenses)}</span>
                  {" · reste "}
                  <span className="font-semibold">{formatFCFA(r.net)}</span>
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
