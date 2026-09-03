import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Wallet } from "lucide-react";
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

function grilleDynamique(nombre: number) {
  if (nombre === 1) {
    return {
      grille: "grid-cols-1",
      padding: "p-3",
      icone: "h-5 w-5",
      nom: "text-sm",
      solde: "text-base",
      ops: "text-xs",
      hauteur: "min-h-[4.5rem]",
    };
  }
  if (nombre === 2) {
    return {
      grille: "grid-cols-2",
      padding: "p-2.5",
      icone: "h-4 w-4",
      nom: "text-xs",
      solde: "text-sm",
      ops: "text-[10px]",
      hauteur: "min-h-[4rem]",
    };
  }
  if (nombre === 3) {
    return {
      grille: "grid-cols-3",
      padding: "p-2",
      icone: "h-3.5 w-3.5",
      nom: "text-[11px]",
      solde: "text-xs",
      ops: "text-[9px]",
      hauteur: "min-h-[3.75rem]",
    };
  }
  if (nombre <= 5) {
    return {
      grille: "grid-cols-2",
      padding: "p-2",
      icone: "h-3.5 w-3.5",
      nom: "text-[11px]",
      solde: "text-xs",
      ops: "text-[9px]",
      hauteur: "min-h-[3.5rem]",
    };
  }
  return {
    grille: "grid-cols-3",
    padding: "p-1.5",
    icone: "h-3 w-3",
    nom: "text-[10px]",
    solde: "text-[11px]",
    ops: "text-[8px]",
    hauteur: "min-h-[3.25rem]",
  };
}

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
  const style = grilleDynamique(comptes.length);

  return (
    <div className="page-anim space-y-4">
      <section className="carte p-4">
        <p className="text-xs text-muted-foreground">Total disponible</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-primary">{formatFCFA(total)}</p>
      </section>

      <section className={`carte space-y-2 ${comptes.length >= 6 ? "p-2" : "p-3"}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Détails actuels</h2>
          <span className="text-xs text-muted-foreground">
            {comptes.length} compte{comptes.length > 1 ? "s" : ""}
          </span>
        </div>

        {comptes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun compte pour le moment.</p>
        ) : (
          <ul className={`grid gap-1.5 ${style.grille}`}>
            {lignes.map((l) => (
              <li key={l.compte}>
                <Link
                  to="/comptes/$compte"
                  params={{ compte: l.compte }}
                  className={`flex flex-col justify-between rounded-lg border border-border/70 bg-secondary/40 ${style.padding} ${style.hauteur} transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary active:scale-[0.99]`}
                >
                  <span className="flex min-w-0 items-center gap-1">
                    <Wallet className={`${style.icone} shrink-0 text-primary`} aria-hidden />
                    <span className={`truncate font-semibold leading-none ${style.nom}`}>
                      {l.compte}
                    </span>
                  </span>

                  <div className="mt-1 space-y-0">
                    <span
                      className={`block font-bold leading-none ${style.solde} ${l.solde < 0 ? "text-destructive" : "text-foreground"}`}
                    >
                      {formatFCFA(l.solde)}
                    </span>
                    <span className={`block leading-none text-muted-foreground ${style.ops}`}>
                      {l.nb} op{l.nb > 1 ? "s" : ""}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
