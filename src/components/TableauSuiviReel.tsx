import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { CarteComparaison, BarreComparaison } from "@/components/BarreComparaison";
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

  return (
    <section className="space-y-3">
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

      <CarteComparaison prevu={totaux.planifie} depense={totaux.reel} />

      {principales.length > 0 && (
        <ul className="carte space-y-3 p-4">
          {principales.map((l) => (
            <li key={l.nom} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-semibold">
                  <span aria-hidden>{l.emoji}</span> {l.nom}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatFCFA(l.reel)} / {formatFCFA(l.planifie)}
                </span>
              </div>
              <BarreComparaison prevu={l.planifie} depense={l.reel} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
