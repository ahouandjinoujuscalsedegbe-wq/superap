import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftRight, Wallet } from "lucide-react";
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
  },
  {
    to: "/comptes/transferts",
    titre: "Transferts",
    texte: "Déplacez de l'argent d'un compte vers un autre.",
  },
] as const;

function ComptesAccueil() {
  const { comptes, transactions, transferts, soldesParCompte } = useSuperApp();

  const lignes = comptes.map((compte) => {
    const liees = transactions.filter((t) => t.compte === compte);
    const entrees =
      liees.filter((t) => t.type === "revenu").reduce((s, t) => s + t.montant, 0) +
      transferts.filter((t) => t.destination === compte).reduce((s, t) => s + t.montant, 0);
    const sorties =
      liees.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0) +
      transferts.filter((t) => t.source === compte).reduce((s, t) => s + t.montant, 0);
    return { compte, entrees, sorties, solde: soldesParCompte[compte] ?? 0, nb: liees.length };
  });

  const total = lignes.reduce((s, l) => s + l.solde, 0);

  return (
    <div className="space-y-4">
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

        {lignes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun compte pour le moment.</p>
        ) : (
          <ul className="grid gap-3">
            {lignes.map((l) => (
              <li key={l.compte}>
                <Link
                  to="/comptes/$compte"
                  params={{ compte: l.compte }}
                  className="block rounded-xl border border-border/70 bg-secondary/40 p-3 transition-colors hover:bg-secondary active:scale-[0.99]"
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
        {liens.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="carte block p-4 transition-colors hover:bg-accent/40">
              <p className="flex items-center gap-2 font-semibold">
                {l.titre === "Transferts" && (
                  <ArrowLeftRight className="h-4 w-4 text-primary" aria-hidden />
                )}
                {l.titre}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{l.texte}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
