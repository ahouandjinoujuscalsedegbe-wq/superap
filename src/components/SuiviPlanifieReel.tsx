import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, ChevronDown } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { useSuperApp } from "@/lib/store";
import { decalerMois } from "@/lib/budget-mensuel";
import { AXES_SUIVI, depensesDuMois, echeancesDuMois } from "@/lib/suivi-planifie";

function moisLisible(mois: string): string {
  return new Date(`${mois}-01T12:00:00`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Suivi du mois : tableau de bord du mois en cours, puis choix du mois et de
 * l'axe de comparaison (enveloppe, dépense, sous-catégorie, catégorie).
 * La comparaison détaillée s'ouvre dans une page dédiée.
 */
export function SuiviPlanifieReel() {
  const { budgets, transactions, enveloppes } = useSuperApp();
  const moisActuel = new Date().toISOString().slice(0, 7);
  const [mois, setMois] = useState(moisActuel);
  const [detailOuvert, setDetailOuvert] = useState(false);

  const choixMois = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((i) => decalerMois(moisActuel, -i)),
    [moisActuel],
  );

  const planifiees = useMemo(() => echeancesDuMois(budgets, moisActuel), [budgets, moisActuel]);
  const reelles = useMemo(
    () => depensesDuMois(transactions, enveloppes, moisActuel),
    [transactions, enveloppes, moisActuel],
  );

  const totalPlanifie = planifiees.reduce((s, l) => s + l.budget.montant, 0);
  const totalReel = reelles.reduce((s, d) => s + d.transaction.montant, 0);
  const ecart = totalReel - totalPlanifie;

  return (
    <div className="space-y-4">
      <section className="carte space-y-3 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Tableau de bord — {moisLisible(moisActuel)}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Planifié</p>
            <p className="text-sm font-bold">{formatFCFA(totalPlanifie)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Réel saisi</p>
            <p className="text-sm font-bold">{formatFCFA(totalReel)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Écart</p>
            <p
              className={`text-sm font-bold ${ecart > 0 ? "text-destructive" : "text-emerald-600"}`}
            >
              {ecart > 0 ? "+" : ""}
              {formatFCFA(ecart)}
            </p>
          </div>
        </div>
      </section>

      <div className="carte overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailOuvert((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-primary">
              Voir la comparaison détaillée
            </p>
            <p className="text-xs text-muted-foreground">{moisLisible(mois)}</p>
          </div>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
              detailOuvert ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>

        {detailOuvert && (
          <div className="space-y-4 border-t p-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Mois à comparer</p>
              <div className="flex flex-wrap gap-2">
                {choixMois.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMois(m)}
                    aria-pressed={m === mois}
                    className={`min-h-11 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      m === mois
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {moisLisible(m)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {AXES_SUIVI.map((a) => (
                <Link
                  key={a.axe}
                  to="/budget/suivi-par/$axe"
                  params={{ axe: a.axe }}
                  search={{ mois }}
                  className="carte flex items-center gap-3 p-4 active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.titre}</p>
                    <p className="text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
