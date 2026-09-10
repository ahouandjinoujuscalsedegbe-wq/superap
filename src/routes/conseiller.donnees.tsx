import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, CheckCircle2, CircleDashed, Database, Target, TrendingUp } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { retourIntelligent } from "@/lib/retour";
import { useIaUnifiee } from "@/lib/ia-unifiee";
import { detecterLimites } from "@/lib/limites-ia";
import { suivreObjectifs } from "@/lib/objectifs";
import { simulerObjectif, type ContexteSimulation } from "@/lib/simulations";

export const Route = createFileRoute("/conseiller/donnees")({
  head: () => ({
    meta: [
      { title: "Mes données et la fiabilité du conseiller — SUPER APP" },
      {
        name: "description",
        content:
          "Volume de données saisies mois par mois et jalons qui font monter la fiabilité du conseiller local.",
      },
      { property: "og:title", content: "Mes données et la fiabilité du conseiller — SUPER APP" },
      {
        property: "og:description",
        content: "Comprenez quand les réponses du conseiller deviennent vraiment fiables.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageDonneesConseiller,
});

const JOUR_MS = 86_400_000;

function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

function PageDonneesConseiller() {
  const router = useRouter();
  const { transactions } = useSuperApp();
  const ia = useIaUnifiee();
  const bilan = useMemo(() => detecterLimites(ia), [ia]);

  // Regroupe les opérations par mois calendaire, du plus récent au plus ancien.
  const mois = useMemo(() => {
    const parMois = new Map<
      string,
      {
        cle: string;
        revenus: number;
        depenses: number;
        montantRevenus: number;
        montantDepenses: number;
      }
    >();
    for (const t of transactions) {
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) continue;
      const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const ligne = parMois.get(cle) ?? {
        cle,
        revenus: 0,
        depenses: 0,
        montantRevenus: 0,
        montantDepenses: 0,
      };
      if (t.type === "revenu") {
        ligne.revenus += 1;
        ligne.montantRevenus += t.montant;
      } else if (t.type === "depense") {
        ligne.depenses += 1;
        ligne.montantDepenses += t.montant;
      }
      parMois.set(cle, ligne);
    }
    const lignes = [...parMois.values()].sort((a, b) => a.cle.localeCompare(b.cle));
    // Cumul d'opérations pour voir quand les seuils de fiabilité sont franchis.
    let cumul = 0;
    return lignes.map((l) => ({ ...l, cumul: (cumul += l.revenus + l.depenses) })).reverse();
  }, [transactions]);

  const libelleMois = (cle: string) =>
    new Date(`${cle}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // Jalons qui font réellement monter la fiabilité, avec progression chiffrée.
  const jalons = useMemo(() => {
    const depenses = transactions.filter((t) => t.type === "depense");
    const revenus = transactions.filter((t) => t.type === "revenu");
    const dates = transactions
      .map((t) => new Date(t.date).getTime())
      .filter((t) => Number.isFinite(t));
    const anciennete = dates.length ? Math.floor((Date.now() - Math.min(...dates)) / JOUR_MS) : 0;
    return [
      {
        id: "operations",
        titre: "20 opérations enregistrées",
        detail: "En dessous, moyennes et conseils ne valent pas grand-chose.",
        actuel: transactions.length,
        cible: 20,
      },
      {
        id: "jours60",
        titre: "60 jours d'historique",
        detail: "Seuil à partir duquel les prévisions deviennent solides.",
        actuel: anciennete,
        cible: 60,
      },
      {
        id: "jours365",
        titre: "12 mois d'historique",
        detail: "Nécessaire pour comparer avec la même saison l'an dernier.",
        actuel: anciennete,
        cible: 365,
      },
      {
        id: "revenus",
        titre: "2 revenus enregistrés",
        detail: "Indispensable pour estimer découvert et capacité d'épargne.",
        actuel: revenus.length,
        cible: 2,
      },
      {
        id: "categories",
        titre: "Dépenses rangées dans une enveloppe",
        detail: "Chaque dépense sans enveloppe rend les répartitions incomplètes.",
        actuel: depenses.filter((t) => t.categorie).length,
        cible: Math.max(1, depenses.length),
      },
      {
        id: "habitudes",
        titre: "30 actions observées",
        detail: "Vos saisies, corrections et avis personnalisent les suggestions.",
        actuel: ia.habitudes.total,
        cible: 30,
      },
      {
        id: "tickets",
        titre: "3 commerçants appris",
        detail: "Corrigez les lectures de tickets pour muscler la reconnaissance.",
        actuel: ia.collaboration.ticketsAppris,
        cible: 3,
      },
    ];
  }, [transactions, mois, ia]);

  const atteints = jalons.filter((j) => j.actuel >= j.cible).length;

  return (
    <div className="app-page-shell min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={() => retourIntelligent(router)}
          aria-label="Retour"
          className="rounded-full p-2"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <h1 className="text-base font-bold">Mes données &amp; fiabilité</h1>
      </header>

      <main className="space-y-4 p-4">
        {/* Fiabilité actuelle */}
        <section className="carte space-y-2 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
            Fiabilité estimée aujourd'hui
          </h2>
          <p className="text-3xl font-extrabold text-primary">{bilan.fiabilite} %</p>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={bilan.fiabilite}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Fiabilité estimée"
          >
            <div className="h-full bg-primary" style={{ width: `${bilan.fiabilite}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{bilan.avertissement}</p>
          <p className="text-xs text-muted-foreground">
            {atteints} jalon(s) sur {jalons.length} franchi(s). Chaque jalon franchi fait monter ce
            score.
          </p>
        </section>

        {/* Jalons */}
        <section className="carte space-y-3 p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Ce qui fait monter la fiabilité
          </h2>
          <ul className="space-y-3">
            {jalons.map((j) => {
              const pct = Math.min(100, Math.round((j.actuel / j.cible) * 100));
              const ok = j.actuel >= j.cible;
              return (
                <li key={j.id} className="space-y-1">
                  <div className="flex items-start gap-2">
                    {ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    ) : (
                      <CircleDashed
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{j.titre}</p>
                      <p className="text-xs text-muted-foreground">{j.detail}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-bold ${ok ? "text-success" : ""}`}>
                      {j.actuel}/{j.cible}
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={j.titre}
                  >
                    <div
                      className={`h-full ${ok ? "bg-success" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Données saisies par mois */}
        <section className="carte space-y-2 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Database className="h-4 w-4 text-primary" aria-hidden />
            Ce que vous avez saisi, mois par mois
          </h2>
          {mois.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Aucune opération saisie pour l'instant. Chaque revenu ou dépense enregistré remplit ce
              tableau et fait monter la fiabilité.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {mois.map((m) => (
                <li key={m.cle} className="space-y-1 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold capitalize">{libelleMois(m.cle)}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.revenus + m.depenses} opération(s) · cumul {m.cumul}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      {m.revenus} revenu(s) ·{" "}
                      <strong className="text-success">{fcfa(m.montantRevenus)}</strong>
                    </span>
                    <span>
                      {m.depenses} dépense(s) ·{" "}
                      <strong className="text-destructive">{fcfa(m.montantDepenses)}</strong>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="px-1 text-center text-[0.7rem] text-muted-foreground">
          Toutes ces statistiques sont calculées sur votre téléphone, sans connexion.
        </p>
      </main>
    </div>
  );
}
