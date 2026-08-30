import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeftRight, Plus, Wallet } from "lucide-react";
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

function ComptesAccueil() {
  const { comptes, transactions, transferts, soldesParCompte } = useSuperApp();

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
    base.sort((a, b) => a.compte.localeCompare(b.compte, "fr"));
    return base;
  }, [comptes, transactions, transferts, soldesParCompte]);

  const total = comptes.reduce((s, c) => s + (soldesParCompte[c] ?? 0), 0);

  return (
    <div className="page-anim space-y-4">
      <section className="carte p-4">
        <p className="text-xs text-muted-foreground">Total disponible</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-primary">{formatFCFA(total)}</p>
      </section>

      <section className="carte space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Détails actuels</h2>
          <span className="text-xs text-muted-foreground">{comptes.length} compte{comptes.length > 1 ? "s" : ""}</span>
        </div>

        {comptes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun compte pour le moment.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-1.5">
            {lignes.map((l) => (
              <li key={l.compte}>
                <Link
                  to="/comptes/$compte"
                  params={{ compte: l.compte }}
                  className="flex flex-col justify-between rounded-lg border border-border/70 bg-secondary/40 p-2 transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary active:scale-[0.99]"
                >
                  <span className="flex min-w-0 items-center gap-1">
                    <Wallet className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                    <span className="truncate text-[10px] font-semibold leading-none">{l.compte}</span>
                  </span>

                  <div className="mt-1.5 space-y-0">
                    <span
                      className={`block text-xs font-bold leading-none ${l.solde < 0 ? "text-destructive" : "text-foreground"}`}
                    >
                      {formatFCFA(l.solde)}
                    </span>
                    <span className="block text-[9px] leading-none text-muted-foreground">
                      {l.nb} op{l.nb > 1 ? "s" : ""}
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
