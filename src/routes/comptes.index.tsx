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
          <div className="space-y-3">
            <Link
              to="/comptes/categorie/$nom"
              params={{ nom: "actifs" }}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Comptes actifs</span>
                <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                  Comptés dans le solde disponible · {actifs.length} compte
                  {actifs.length > 1 ? "s" : ""}
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold">{formatFCFA(totalActifs)}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>

            <Link
              to="/comptes/categorie/$nom"
              params={{ nom: "passifs" }}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <PiggyBank className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Comptes passifs</span>
                <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                  Hors solde disponible · {passifs.length} compte
                  {passifs.length > 1 ? "s" : ""}
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold">{formatFCFA(totalPassifs)}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
