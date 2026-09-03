import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, ShieldOff, Wallet, PiggyBank } from "lucide-react";
import { ordreEffectifComptes, useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { suggererIcone } from "@/lib/icone-auto";

export const Route = createFileRoute("/comptes/categorie/$nom")({
  head: ({ params }) => {
    const nom = nomAffiche(params.nom);
    return {
      meta: [
        { title: `${nom} — Détails des comptes en FCFA` },
        {
          name: "description",
          content: `Liste des ${nom.toLowerCase()} avec soldes, entrées, sorties et nombre d'opérations en francs CFA.`,
        },
        { property: "og:title", content: `${nom} — SUPER APP` },
        {
          property: "og:description",
          content: `Détail des comptes classés comme ${nom.toLowerCase()}.`,
        },
      ],
    };
  },
  component: PageCategorieComptes,
});

function nomAffiche(nom: string): string {
  const decode = decodeURIComponent(nom).toLowerCase();
  if (decode === "actifs") return "Comptes actifs";
  if (decode === "passifs") return "Comptes passifs";
  return decode;
}

function iconeCategorie(nom: string) {
  const decode = decodeURIComponent(nom).toLowerCase();
  if (decode === "passifs") return <PiggyBank className="h-5 w-5" aria-hidden />;
  return <Wallet className="h-5 w-5" aria-hidden />;
}

function PageCategorieComptes() {
  const { nom } = Route.useParams();
  const categorie = decodeURIComponent(nom).toLowerCase();
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
      .filter((l): l is NonNullable<typeof l> => l != null)
      .filter((l) => {
        const exclu = comptesExclus.includes(l.compte);
        return categorie === "passifs" ? exclu : !exclu;
      });
  }, [comptes, ordreComptes, transactions, transferts, soldesParCompte, comptesExclus, categorie]);

  const total = lignes.reduce((s, l) => s + l.solde, 0);

  return (
    <div className="space-y-5">
      <section className="carte space-y-4 p-4">
        <div>
          <h1 className="text-lg font-semibold">{nomAffiche(nom)}</h1>
          <p className="text-sm text-muted-foreground">
            {lignes.length} compte{lignes.length > 1 ? "s" : ""} · {formatFCFA(total)} au total.
          </p>
        </div>

        {lignes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun compte dans cette catégorie.</p>
        ) : (
          <ul className="space-y-2">
            {lignes.map((l) => {
              const exclu = comptesExclus.includes(l.compte);
              return (
                <li key={l.compte}>
                  <Link
                    to="/comptes/$compte"
                    params={{ compte: l.compte }}
                    className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary active:scale-[0.99]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl">
                      {iconesComptes[l.compte] ?? suggererIcone(l.compte, "compte")}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{l.compte}</span>
                        {exclu && (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                            title="Exclu du solde disponible"
                          >
                            <ShieldOff className="h-3 w-3" aria-hidden /> Hors disponible
                          </span>
                        )}
                      </span>
                      <span
                        className={`mt-0.5 block text-base font-bold leading-tight ${
                          l.solde < 0 ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        {formatFCFA(l.solde)}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                        + {formatFCFA(l.entrees)} · − {formatFCFA(l.sorties)} · {l.nb} op
                        {l.nb > 1 ? "s" : ""}
                      </span>
                    </span>

                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
