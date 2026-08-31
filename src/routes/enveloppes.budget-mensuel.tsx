import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";
import { formatFCFA } from "@/lib/format";
import { comparerBudgets, decalerMois, totauxBudget } from "@/lib/budget-mensuel";
import { useSuperApp } from "@/lib/store";

export const Route = createFileRoute("/enveloppes/budget-mensuel")({
  head: () => ({
    meta: [
      { title: "Budget mensuel — Enveloppes comparées aux dépenses réelles" },
      {
        name: "description",
        content:
          "Budget mensuel calculé automatiquement à partir de la période de renouvellement de chaque enveloppe, comparé aux dépenses réelles en FCFA.",
      },
      { property: "og:title", content: "Budget mensuel des enveloppes — SUPER APP" },
      {
        property: "og:description",
        content:
          "Comparez le budget mensuel automatique de chaque enveloppe à vos dépenses réelles du mois.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BudgetMensuel,
});

const LIBELLE_SOURCE: Record<string, string> = {
  periode: "Déduit de la période de renouvellement",
  revenu: "Part moyenne de vos revenus",
  plafond: "Plafond de l'enveloppe (aucune période réglée)",
  aucune: "Aucun budget calculable",
};

function moisLisible(mois: string): string {
  const d = new Date(`${mois}-01T12:00:00`);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function BudgetMensuel() {
  const { enveloppes, transactions } = useSuperApp();
  const moisActuel = new Date().toISOString().slice(0, 7);
  const [mois, setMois] = useState(moisActuel);

  const lignes = useMemo(
    () => comparerBudgets(enveloppes, transactions, mois),
    [enveloppes, transactions, mois],
  );
  const totaux = useMemo(() => totauxBudget(lignes), [lignes]);

  const choixMois = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((i) => decalerMois(moisActuel, -i)),
    [moisActuel],
  );

  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/action" label="Retour à Action" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Budget mensuel</h1>
        <p className="text-sm text-muted-foreground">
          Calculé seul depuis la période de renouvellement de chaque enveloppe, puis comparé aux
          dépenses réelles.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {choixMois.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMois(m)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              m === mois ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {moisLisible(m)}
          </button>
        ))}
      </div>

      <section className="carte grid grid-cols-3 gap-2 p-4 text-center">
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Budget</p>
          <p className="text-sm font-bold">{formatFCFA(totaux.budget)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Dépensé</p>
          <p className="text-sm font-bold">{formatFCFA(totaux.depense)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Écart</p>
          <p
            className={`text-sm font-bold ${totaux.ecart > 0 ? "text-destructive" : "text-emerald-600"}`}
          >
            {totaux.ecart > 0 ? "+" : ""}
            {formatFCFA(totaux.ecart)}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
          Enveloppe par enveloppe
        </h2>

        {lignes.length === 0 ? (
          <p className="carte p-4 text-sm text-muted-foreground">
            Aucune enveloppe pour le moment.
          </p>
        ) : (
          lignes.map((l) => {
            const depassement = l.ecart > 0;
            const largeur = Math.min(100, Math.max(0, l.consommation));
            return (
              <article key={l.enveloppe.id} className="carte space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold">
                    <span aria-hidden>{l.enveloppe.emoji}</span> {l.enveloppe.nom}
                  </p>
                  <span
                    className={`flex shrink-0 items-center gap-1 text-xs font-semibold ${
                      depassement ? "text-destructive" : "text-emerald-600"
                    }`}
                  >
                    {depassement ? (
                      <TrendingUp aria-hidden className="h-4 w-4" />
                    ) : (
                      <TrendingDown aria-hidden className="h-4 w-4" />
                    )}
                    {depassement ? "+" : ""}
                    {formatFCFA(l.ecart)}
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${depassement ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${largeur}%` }}
                  />
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Budget mensuel</dt>
                    <dd className="font-medium">{formatFCFA(l.budgetMensuel)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Dépenses réelles</dt>
                    <dd className="font-medium">
                      {formatFCFA(l.depenseMois)} ({l.consommation} %)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Moyenne 3 mois</dt>
                    <dd className="font-medium">{formatFCFA(l.moyenneDepense)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Base du calcul</dt>
                    <dd className="font-medium">{LIBELLE_SOURCE[l.source]}</dd>
                  </div>
                </dl>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
