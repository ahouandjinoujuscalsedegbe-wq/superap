import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeftRight, Plus, Search, Wallet } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/comptes/")({
  head: () => ({
    meta: [
      { title: "Comptes — Détails actuels des soldes en FCFA" },
      {
        name: "description",
        content:
          "Tableau de bord des comptes du foyer : soldes, entrées, sorties, actions et transferts en francs CFA.",
      },
      { property: "og:title", content: "Comptes — SUPER APP" },
      {
        property: "og:description",
        content: "Soldes par compte, gestion des comptes et transferts internes en FCFA.",
      },
    ],
  }),
  component: ComptesAccueil,
});

const liens = [
  {
    to: "/comptes/action",
    titre: "Action",
    texte: "Ajoutez, renommez ou supprimez vos comptes.",
    icone: Plus,
  },
  {
    to: "/comptes/transferts",
    titre: "Transferts",
    texte: "Déplacez de l'argent d'un compte vers un autre.",
    icone: ArrowLeftRight,
  },
] as const;

type Tri = "nom" | "solde-desc" | "solde-asc" | "operations";

const TRIS: { valeur: Tri; label: string }[] = [
  { valeur: "nom", label: "Nom (A → Z)" },
  { valeur: "solde-desc", label: "Solde décroissant" },
  { valeur: "solde-asc", label: "Solde croissant" },
  { valeur: "operations", label: "Plus d'opérations" },
];

const champ =
  "w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none transition-shadow focus:ring-2 focus:ring-ring";

function ComptesAccueil() {
  const { comptes, transactions, transferts, soldesParCompte } = useSuperApp();
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState<Tri>("nom");

  const lignes = useMemo(() => {
    const base = comptes.map((compte) => {
      const liees = transactions.filter((t) => t.compte === compte);
      const entrees =
        liees.filter((t) => t.type === "revenu").reduce((s, t) => s + t.montant, 0) +
        transferts.filter((t) => t.destination === compte).reduce((s, t) => s + t.montant, 0);
      const sorties =
        liees.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0) +
        transferts.filter((t) => t.source === compte).reduce((s, t) => s + t.montant, 0);
      return { compte, entrees, sorties, solde: soldesParCompte[compte] ?? 0, nb: liees.length };
    });

    const q = recherche.trim().toLowerCase();
    const filtrees = q ? base.filter((l) => l.compte.toLowerCase().includes(q)) : base;

    const triees = [...filtrees];
    triees.sort((a, b) => {
      if (tri === "solde-desc") return b.solde - a.solde;
      if (tri === "solde-asc") return a.solde - b.solde;
      if (tri === "operations") return b.nb - a.nb;
      return a.compte.localeCompare(b.compte, "fr");
    });
    return triees;
  }, [comptes, transactions, transferts, soldesParCompte, recherche, tri]);

  const total = comptes.reduce((s, c) => s + (soldesParCompte[c] ?? 0), 0);

  return (
    <div className="page-anim space-y-4">
      <section className="carte p-5">
        <p className="text-sm text-muted-foreground">Total disponible</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-primary">{formatFCFA(total)}</p>
      </section>

      <section className="carte space-y-3 p-4">
        <div>
          <h2 className="text-lg font-semibold">Détails actuels</h2>
          <p className="text-sm text-muted-foreground">
            Vos comptes et leur solde. Touchez un compte pour voir son historique détaillé.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative min-w-0">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="recherche-compte"
              value={recherche}
              onChange={(ev) => setRecherche(ev.target.value)}
              placeholder="Rechercher un compte…"
              aria-label="Rechercher un compte"
              className={`${champ} pl-9`}
            />
          </div>
          <select
            value={tri}
            onChange={(ev) => setTri(ev.target.value as Tri)}
            aria-label="Trier les comptes"
            className={`${champ} sm:w-52`}
          >
            {TRIS.map((t) => (
              <option key={t.valeur} value={t.valeur}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {comptes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun compte pour le moment.</p>
        ) : lignes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun compte ne correspond à « {recherche.trim()} ».
          </p>
        ) : (
          <ul className="grid gap-3">
            {lignes.map((l) => (
              <li key={l.compte}>
                <Link
                  to="/comptes/$compte"
                  params={{ compte: l.compte }}
                  className="block rounded-xl border border-border/70 bg-secondary/40 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Wallet className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="truncate font-semibold">{l.compte}</span>
                    </span>
                    <span
                      className={`shrink-0 font-bold ${l.solde < 0 ? "text-destructive" : "text-foreground"}`}
                    >
                      {formatFCFA(l.solde)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">
                      + {formatFCFA(l.entrees)} · − {formatFCFA(l.sorties)}
                    </span>
                    <span className="shrink-0">
                      {l.nb} opération{l.nb > 1 ? "s" : ""} ›
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ul className="grid gap-3">
        {liens.map((l) => {
          const Icone = l.icone;
          return (
            <li key={l.to}>
              <Link
                to={l.to}
                className="carte flex w-full items-center gap-3 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/40 active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icone aria-hidden className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{l.titre}</span>
                  <span className="block text-sm text-muted-foreground">{l.texte}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
