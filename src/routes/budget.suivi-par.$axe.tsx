import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { formatFCFA } from "@/lib/format";
import { BarreComparaison, phraseEcart } from "@/components/BarreComparaison";
import { useSuperApp } from "@/lib/store";
import { decalerMois } from "@/lib/budget-mensuel";
import { AXES_SUIVI, comparerParAxe, type AxeSuivi } from "@/lib/suivi-planifie";

export const Route = createFileRoute("/budget/suivi-par/$axe")({
  validateSearch: (recherche: Record<string, unknown>) => ({
    mois: typeof recherche["mois"] === "string" ? (recherche["mois"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Comparaison planifié / réel — Suivi du mois" },
      {
        name: "description",
        content:
          "Comparez les dépenses planifiées et les dépenses réelles du mois choisi, par enveloppe, par dépense, par sous-catégorie ou par catégorie.",
      },
      { property: "og:title", content: "Comparaison planifié / réel — SUPER APP" },
      {
        property: "og:description",
        content: "Détail du planifié et du réel du mois selon l'axe de comparaison choisi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageSuiviParAxe,
});

function moisLisible(mois: string): string {
  return new Date(`${mois}-01T12:00:00`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

function jourLisible(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function PageSuiviParAxe() {
  const { axe } = Route.useParams();
  const { mois: moisChoisi } = Route.useSearch();
  const { budgets, transactions, enveloppes } = useSuperApp();

  const moisActuel = new Date().toISOString().slice(0, 7);
  const [mois, setMois] = useState(moisChoisi ?? moisActuel);
  const choixMois = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((i) => decalerMois(moisActuel, -i)),
    [moisActuel],
  );

  const axeValide: AxeSuivi = (AXES_SUIVI.find((a) => a.axe === axe)?.axe ??
    "enveloppe") as AxeSuivi;
  const definition = AXES_SUIVI.find((a) => a.axe === axeValide)!;

  const groupes = useMemo(
    () => comparerParAxe(budgets, transactions, enveloppes, mois, axeValide),
    [budgets, transactions, enveloppes, mois, axeValide],
  );

  const totalPlanifie = groupes.reduce((s, g) => s + g.planifie, 0);
  const totalReel = groupes.reduce((s, g) => s + g.reel, 0);
  const ecart = totalReel - totalPlanifie;

  return (
    <div className="space-y-4">
      <h1 className="sr-only">{definition.titre}</h1>

      <div className="flex flex-wrap gap-2">
        {choixMois.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMois(m)}
            aria-pressed={m === mois}
            className={`min-h-11 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              m === mois ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {moisLisible(m)}
          </button>
        ))}
      </div>

      <section className="carte space-y-3 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Tout le mois de {moisLisible(mois)}
        </p>
        <BarreComparaison prevu={totalPlanifie} depense={totalReel} />
        <p
          className={`rounded-xl p-3 text-sm font-semibold ${
            ecart > 0
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {ecart > 0
            ? `Tu as dépensé ${formatFCFA(ecart)} de plus que prévu.`
            : ecart === 0
              ? "Tu as dépensé exactement ce qui était prévu."
              : `Il te reste ${formatFCFA(-ecart)} sur ce qui était prévu.`}
        </p>
      </section>

      {groupes.length === 0 ? (
        <p className="carte p-4 text-sm text-muted-foreground">
          Rien de prévu ni de dépensé sur {moisLisible(mois)}.
        </p>
      ) : (
        <ul className="space-y-2">
          {groupes.map((g) => (
            <li key={g.cle} className="carte space-y-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold">
                  <span aria-hidden>{g.emoji}</span> {g.cle}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    g.ecart > 0
                      ? "bg-destructive/10 text-destructive"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {phraseEcart(g.planifie, g.reel)}
                </span>
              </div>

              <BarreComparaison prevu={g.planifie} depense={g.reel} compact />

              <ul className="space-y-1 border-t border-border pt-2">
                {g.lignes.map((l, i) => (
                  <li
                    key={`${l.origine}-${l.libelle}-${l.date}-${i}`}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 ${
                        l.origine === "planifie"
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {l.origine === "planifie" ? "📝 Prévu" : "💸 Dépensé"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {jourLisible(l.date)} · {l.libelle || "Sans libellé"}
                    </span>
                    <span className="shrink-0 font-semibold">{formatFCFA(l.montant)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
