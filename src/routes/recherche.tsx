import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatDateFr, formatFCFA } from "@/lib/format";
import { LIBELLES_TYPE, rechercher, type TypeResultat } from "@/lib/recherche";

export const Route = createFileRoute("/recherche")({
  head: () => ({
    meta: [
      { title: "Recherche globale — SUPER APP" },
      {
        name: "description",
        content:
          "Retrouvez instantanément une opération, une enveloppe, un compte, une dette ou une dépense planifiée dans votre budget familial.",
      },
      { property: "og:title", content: "Recherche globale" },
      {
        property: "og:description",
        content: "Toutes vos données budgétaires retrouvées en un instant, hors ligne.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageRecherche,
});

function PageRecherche() {
  const {
    transactions,
    enveloppes,
    comptes,
    dettes,
    budgets,
    transferts,
    objectifs,
    soldesParCompte,
    depensesParEnveloppe,
  } = useSuperApp();
  const [requete, setRequete] = useState("");
  const [filtre, setFiltre] = useState<TypeResultat | "tous">("tous");

  const resultats = useMemo(
    () =>
      rechercher(requete, {
        transactions,
        enveloppes,
        comptes,
        dettes,
        budgets,
        transferts,
        objectifs,
        soldesParCompte,
        depensesParEnveloppe,
      }),
    [
      requete,
      transactions,
      enveloppes,
      comptes,
      dettes,
      budgets,
      transferts,
      objectifs,
      soldesParCompte,
      depensesParEnveloppe,
    ],
  );

  const typesPresents = useMemo(() => [...new Set(resultats.map((r) => r.type))], [resultats]);
  const visibles = filtre === "tous" ? resultats : resultats.filter((r) => r.type === filtre);

  return (
    <div className="space-y-4 pt-4">

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Search className="h-6 w-6 text-primary" aria-hidden />
          Recherche
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Opérations, enveloppes, comptes, dettes, planifications et objectifs.
        </p>
      </header>

      <div className="carte flex items-center gap-2 p-2">
        <Search className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Marché, Espèces, 5000…"
          aria-label="Rechercher"
          autoFocus
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
        />
        {requete && (
          <button
            type="button"
            onClick={() => setRequete("")}
            aria-label="Effacer la recherche"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-accent/40"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {typesPresents.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFiltre("tous")}
            aria-pressed={filtre === "tous"}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              filtre === "tous"
                ? "bg-primary text-primary-foreground"
                : "border border-input bg-card hover:bg-accent/40"
            }`}
          >
            Tout ({resultats.length})
          </button>
          {typesPresents.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFiltre(t)}
              aria-pressed={filtre === t}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                filtre === t
                  ? "bg-primary text-primary-foreground"
                  : "border border-input bg-card hover:bg-accent/40"
              }`}
            >
              {LIBELLES_TYPE[t]} ({resultats.filter((r) => r.type === t).length})
            </button>
          ))}
        </div>
      )}

      <section className="space-y-2">
        {requete.trim().length < 2 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Saisissez au moins deux lettres pour lancer la recherche.
          </p>
        ) : visibles.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucun résultat pour « {requete} ».
          </p>
        ) : (
          visibles.map((r) => (
            <Link
              key={`${r.type}-${r.id}`}
              to={r.lien}
              className="carte flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent/30"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{r.titre}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {LIBELLES_TYPE[r.type]} · {r.detail}
                  {r.date ? ` · ${formatDateFr(r.date)}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold ${
                  r.sens === 1 ? "text-success" : r.sens === -1 ? "text-destructive" : ""
                }`}
              >
                {r.sens === 1 ? "+ " : r.sens === -1 ? "− " : ""}
                {formatFCFA(r.montant)}
              </span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
