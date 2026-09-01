import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, FileText, SlidersHorizontal, X } from "lucide-react";
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

  const annees = useMemo(
    () => Array.from(new Set(mois.map((m) => m.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [mois],
  );

  const [filtreOuvert, setFiltreOuvert] = useState(false);
  const [annee, setAnnee] = useState<string>("");
  const [moisChoisi, setMoisChoisi] = useState<string>("");

  const moisDeLAnnee = useMemo(
    () => (annee ? mois.filter((m) => m.startsWith(annee)) : mois),
    [mois, annee],
  );

  const resumesFiltres = useMemo(
    () =>
      resumes.filter((r) => {
        if (moisChoisi) return r.mois === moisChoisi;
        if (annee) return r.mois.startsWith(annee);
        return true;
      }),
    [resumes, annee, moisChoisi],
  );

  const filtreActif = Boolean(annee || moisChoisi);

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

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltreOuvert((v) => !v)}
            aria-expanded={filtreOuvert}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium active:opacity-80 ${
              filtreActif ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filtre
          </button>
          {filtreActif && (
            <button
              type="button"
              onClick={() => {
                setAnnee("");
                setMoisChoisi("");
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-xs text-muted-foreground active:opacity-80"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Réinitialiser
            </button>
          )}
        </div>

        {filtreOuvert && (
          <div className="carte space-y-3 p-4">
            <div>
              <label htmlFor="filtre-annee" className="text-xs font-medium text-muted-foreground">
                Année
              </label>
              <select
                id="filtre-annee"
                value={annee}
                onChange={(e) => {
                  setAnnee(e.target.value);
                  setMoisChoisi("");
                }}
                className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm"
              >
                <option value="">Toutes les années</option>
                {annees.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filtre-mois" className="text-xs font-medium text-muted-foreground">
                Mois
              </label>
              <select
                id="filtre-mois"
                value={moisChoisi}
                onChange={(e) => setMoisChoisi(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm capitalize"
              >
                <option value="">Tous les mois</option>
                {moisDeLAnnee.map((m) => (
                  <option key={m} value={m}>
                    {libelleMois(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {resumesFiltres.length === 0 && (
        <p className="carte p-4 text-sm text-muted-foreground">
          Aucun rapport disponible pour ce filtre.
        </p>
      )}

      <ul className="space-y-2">
        {resumesFiltres.map((r) => (
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
