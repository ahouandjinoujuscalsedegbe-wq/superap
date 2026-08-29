import { createFileRoute } from "@tanstack/react-router";
import { COMPTES, useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/comptes")({
  head: () => ({
    meta: [
      { title: "Comptes — Soldes du foyer en FCFA" },
      {
        name: "description",
        content:
          "Consultez le solde de chaque compte du foyer : espèces, banque et mobile money, en francs CFA.",
      },
      { property: "og:title", content: "Comptes — SUPER APP" },
      {
        property: "og:description",
        content: "Soldes par compte : espèces, banque, MoMo, Wave et carte virtuelle.",
      },
    ],
  }),
  component: Comptes,
});

function Comptes() {
  const { transactions } = useSuperApp();

  const lignes = COMPTES.map((compte) => {
    const liees = transactions.filter((t) => t.compte === compte);
    const entrees = liees.filter((t) => t.type === "revenu").reduce((s, t) => s + t.montant, 0);
    const sorties = liees.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0);
    return { compte, entrees, sorties, solde: entrees - sorties, nb: liees.length };
  });

  const total = lignes.reduce((s, l) => s + l.solde, 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Comptes</h1>
        <p className="text-sm text-muted-foreground">Répartition de votre argent par support.</p>
      </header>

      <section className="carte p-4">
        <p className="text-sm text-muted-foreground">Total disponible</p>
        <p className="mt-1 text-3xl font-bold text-primary">{formatFCFA(total)}</p>
      </section>

      <ul className="space-y-3">
        {lignes.map((l) => (
          <li key={l.compte} className="carte p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{l.compte}</span>
              <span className="font-bold">{formatFCFA(l.solde)}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>
                + {formatFCFA(l.entrees)} · − {formatFCFA(l.sorties)}
              </span>
              <span>
                {l.nb} opération{l.nb > 1 ? "s" : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
