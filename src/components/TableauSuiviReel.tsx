import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { comparerPlanifieEtReel } from "@/lib/suivi-planifie";

function moisLisible(mois: string): string {
  const d = new Date(`${mois}-01T12:00:00`);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/**
 * Tableau de bord « Suivi réel / prévu » du mois en cours, affiché sur
 * l'accueil de la Budgétisation. Calcul entièrement local.
 */
export function TableauSuiviReel() {
  const { budgets, transactions, enveloppes } = useSuperApp();
  const mois = new Date().toISOString().slice(0, 7);

  const lignes = useMemo(
    () => comparerPlanifieEtReel(budgets, transactions, enveloppes, mois),
    [budgets, transactions, enveloppes, mois],
  );

  const totaux = useMemo(() => {
    const planifie = lignes.reduce((s, l) => s + l.planifie, 0);
    const reel = lignes.reduce((s, l) => s + l.reel, 0);
    return { planifie, reel, ecart: reel - planifie };
  }, [lignes]);

  const principales = useMemo(
    () => [...lignes].sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart)).slice(0, 4),
    [lignes],
  );

  const depassement = totaux.ecart > 0;
  const consommation = totaux.planifie > 0 ? Math.round((totaux.reel / totaux.planifie) * 100) : 0;

  return (
    <section className="carte space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
            Suivi réel / prévu
          </h2>
          <p className="text-xs text-muted-foreground">{moisLisible(mois)}</p>
        </div>
        <Link
          to="/budget/suivi"
          className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary"
        >
          Détail
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Planifié</p>
          <p className="text-sm font-bold">{formatFCFA(totaux.planifie)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Réel</p>
          <p className="text-sm font-bold">{formatFCFA(totaux.reel)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Écart</p>
          <p
            className={`flex items-center justify-center gap-1 text-sm font-bold ${
              depassement ? "text-destructive" : "text-emerald-600"
            }`}
          >
            {depassement ? (
              <TrendingUp aria-hidden className="h-4 w-4" />
            ) : (
              <TrendingDown aria-hidden className="h-4 w-4" />
            )}
            {depassement ? "+" : ""}
            {formatFCFA(totaux.ecart)}
          </p>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${depassement ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${Math.min(100, Math.max(0, consommation))}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {totaux.planifie > 0
          ? `${consommation} % du planifié déjà dépensé ce mois.`
          : "Aucune dépense planifiée ce mois : seul le réel est affiché."}
      </p>

      {principales.length > 0 && (
        <ul className="space-y-1">
          {principales.map((l) => (
            <li
              key={l.nom}
              className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-2 py-1.5"
            >
              <span className="min-w-0 truncate text-xs font-medium">
                <span aria-hidden>{l.emoji}</span> {l.nom}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatFCFA(l.reel)} / {formatFCFA(l.planifie)}
              </span>
              <span
                className={`shrink-0 text-xs font-semibold ${
                  l.ecart > 0 ? "text-destructive" : "text-emerald-600"
                }`}
              >
                {l.ecart > 0 ? "+" : ""}
                {formatFCFA(l.ecart)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
