import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronRight, ShieldOff, Wallet, PiggyBank } from "lucide-react";
import { ordreEffectifComptes, useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { suggererIcone } from "@/lib/icone-auto";

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

function ComptesAccueil() {
  const {
    comptes,
    ordreComptes,
    comptesExclus,
    iconesComptes,
    transactions,
    transferts,
    soldesParCompte,
  } = useSuperApp();

  const lignes = useMemo(() => {
    const parCompte = new Map(
      comptes.map((compte) => {
        const liees = transactions.filter((t) => t.compte === compte);
        const entrees =
          liees.filter((t) => t.type === "revenu").reduce((s, t) => s + t.montant, 0) +
          transferts.filter((t) => t.destination === compte).reduce((s, t) => s + t.montant, 0);
        const sorties =
          liees.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0) +
          transferts.filter((t) => t.source === compte).reduce((s, t) => s + t.montant, 0);
        return [
          compte,
          { compte, entrees, sorties, solde: soldesParCompte[compte] ?? 0, nb: liees.length },
        ] as const;
      }),
    );
    return ordreEffectifComptes(comptes, ordreComptes)
      .map((c) => parCompte.get(c))
      .filter((l): l is NonNullable<typeof l> => l != null);
  }, [comptes, ordreComptes, transactions, transferts, soldesParCompte]);

  const total = comptes.reduce((s, c) => s + (soldesParCompte[c] ?? 0), 0);

  // Deux familles : comptes actifs (comptés dans le solde disponible) et
  // comptes passifs (épargne, caisse, diamant… hors solde disponible).
  const actifs = lignes.filter((l) => !comptesExclus.includes(l.compte));
  const passifs = lignes.filter((l) => comptesExclus.includes(l.compte));

  const totalActifs = actifs.reduce((s, l) => s + l.solde, 0);
  const totalPassifs = passifs.reduce((s, l) => s + l.solde, 0);

  return (
    <div className="page-anim space-y-4">
      <section className="carte p-4">
        <p className="text-xs text-muted-foreground">Total disponible</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-primary">{formatFCFA(total)}</p>
      </section>

      <section className="carte space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Détails actuels</h2>
          <span className="text-xs text-muted-foreground">
            {comptes.length} compte{comptes.length > 1 ? "s" : ""}
          </span>
        </div>

        {comptes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun compte pour le moment.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Comptes actifs</h3>
                <span className="text-[11px] text-muted-foreground">
                  Comptés dans le solde disponible · {actifs.length}
                </span>
              </div>
              {actifs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun compte actif.</p>
              ) : (
                <ul className="space-y-2">{actifs.map(bande)}</ul>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Comptes passifs</h3>
                <span className="text-[11px] text-muted-foreground">
                  Hors solde disponible · {passifs.length}
                </span>
              </div>
              {passifs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun compte passif.</p>
              ) : (
                <ul className="space-y-2">{passifs.map(bande)}</ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
