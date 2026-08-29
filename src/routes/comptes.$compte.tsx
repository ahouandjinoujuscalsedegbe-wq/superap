import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";

export const Route = createFileRoute("/comptes/$compte")({
  head: ({ params }) => {
    const nom = decodeURIComponent(params.compte);
    return {
      meta: [
        { title: `${nom} — Détails du compte en FCFA` },
        {
          name: "description",
          content: `Historique filtrable des revenus, dépenses et transferts du compte ${nom}, avec solde recalculé en temps réel.`,
        },
        { property: "og:title", content: `${nom} — SUPER APP` },
        {
          property: "og:description",
          content: `Solde et historique détaillé du compte ${nom} en francs CFA.`,
        },
      ],
    };
  },
  component: DetailCompte,
});

type Filtre = "tout" | "revenu" | "depense" | "transfert";

const FILTRES: { id: Filtre; label: string }[] = [
  { id: "tout", label: "Tout" },
  { id: "revenu", label: "Revenus" },
  { id: "depense", label: "Dépenses" },
  { id: "transfert", label: "Transferts" },
];

function DetailCompte() {
  const { compte: brut } = Route.useParams();
  const compte = decodeURIComponent(brut);
  const { comptes, transactions, transferts, soldesParCompte, enveloppes } = useSuperApp();
  const [filtre, setFiltre] = useState<Filtre>("tout");

  const existe = comptes.includes(compte);
  const solde = soldesParCompte[compte] ?? 0;

  type Ligne = {
    id: string;
    date: string;
    libelle: string;
    detail: string;
    montant: number;
    genre: Filtre;
  };

  const lignes: Ligne[] = [
    ...transactions
      .filter((t) => t.compte === compte)
      .map<Ligne>((t) => ({
        id: t.id,
        date: t.date,
        libelle: t.libelle || (t.type === "revenu" ? "Revenu" : "Dépense"),
        detail:
          t.type === "depense"
            ? (enveloppes.find((e) => e.id === t.categorie)?.nom ?? t.categorie)
            : t.categorie,
        montant: t.type === "revenu" ? t.montant : -t.montant,
        genre: t.type === "revenu" ? "revenu" : "depense",
      })),
    ...transferts
      .filter((t) => t.source === compte || t.destination === compte)
      .map<Ligne>((t) => ({
        id: t.id,
        date: t.date,
        libelle: t.source === compte ? `Vers ${t.destination}` : `Depuis ${t.source}`,
        detail: t.note || "Transfert",
        montant: t.source === compte ? -t.montant : t.montant,
        genre: "transfert",
      })),
  ].sort((a, z) => +new Date(z.date) - +new Date(a.date));

  const visibles = filtre === "tout" ? lignes : lignes.filter((l) => l.genre === filtre);
  const entrees = visibles.filter((l) => l.montant > 0).reduce((s, l) => s + l.montant, 0);
  const sorties = visibles.filter((l) => l.montant < 0).reduce((s, l) => s - l.montant, 0);

  return (
    <div className="space-y-5">
      <header className="pr-12">
        <Link
          to="/comptes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Comptes
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight break-words">{compte}</h1>
      </header>

      {!existe ? (
        <p className="carte p-4 text-sm text-muted-foreground">Ce compte n'existe plus.</p>
      ) : (
        <>
          <section className="carte p-4">
            <p className="text-sm text-muted-foreground">Solde actuel</p>
            <p
              className={`mt-1 text-3xl font-bold ${solde < 0 ? "text-destructive" : "text-primary"}`}
            >
              {formatFCFA(solde)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Filtre affiché : + {formatFCFA(entrees)} · − {formatFCFA(sorties)}
            </p>
          </section>

          <div className="flex flex-wrap gap-2">
            {FILTRES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltre(f.id)}
                aria-pressed={filtre === f.id}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  filtre === f.id
                    ? "bg-primary text-primary-foreground"
                    : "border border-input text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {visibles.length === 0 ? (
            <p className="carte p-4 text-sm text-muted-foreground">
              Aucune opération pour ce filtre.
            </p>
          ) : (
            <ul className="space-y-2">
              {visibles.map((l) => (
                <li
                  key={`${l.genre}-${l.id}`}
                  className="carte flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.libelle}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateFr(l.date)} · {l.detail}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      l.montant >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {l.montant >= 0 ? "+" : "−"} {formatFCFA(Math.abs(l.montant))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
