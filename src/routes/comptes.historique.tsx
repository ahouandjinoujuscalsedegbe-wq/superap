import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, History } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { lireHistoriqueComptes, libelleAction } from "@/lib/historique-comptes";

export const Route = createFileRoute("/comptes/historique")({
  head: () => ({
    meta: [
      { title: "Historique des comptes — Tous les mouvements en FCFA" },
      {
        name: "description",
        content:
          "Journal complet des comptes : entrées, sorties, transferts internes et actions de gestion, avec dates et montants en francs CFA.",
      },
      { property: "og:title", content: "Historique des comptes — SUPER APP" },
      {
        property: "og:description",
        content: "Toutes les opérations et tous les mouvements effectués avec vos comptes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoriqueComptes,
});

type Filtre = "tout" | "operations" | "transferts" | "actions";

type Ligne = {
  id: string;
  date: string;
  genre: "operation" | "transfert" | "action";
  titre: string;
  detail: string;
  montant?: number;
  sens?: "entree" | "sortie" | "neutre";
};

function HistoriqueComptes() {
  const { transactions, transferts, comptes } = useSuperApp();
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [compte, setCompte] = useState("");

  const lignes = useMemo<Ligne[]>(() => {
    const journal = lireHistoriqueComptes();
    const tout: Ligne[] = [
      ...transactions.map((t) => ({
        id: `op-${t.id}`,
        date: t.date,
        genre: "operation" as const,
        titre: t.libelle || (t.type === "revenu" ? "Revenu" : "Dépense"),
        detail: t.compte,
        montant: t.montant,
        sens: t.type === "revenu" ? ("entree" as const) : ("sortie" as const),
      })),
      ...transferts.map((v) => ({
        id: `tr-${v.id}`,
        date: v.date,
        genre: "transfert" as const,
        titre: `${v.source} → ${v.destination}`,
        detail: v.note || "Transfert entre comptes",
        montant: v.montant,
        sens: "neutre" as const,
      })),
      ...journal.map((e) => ({
        id: `ac-${e.id}`,
        date: e.date,
        genre: "action" as const,
        titre: `${libelleAction(e.action)} · ${e.compte}`,
        detail: `${e.details} · ${e.auteur}`,
      })),
    ];

    return tout
      .filter((l) => (filtre === "tout" ? true : l.genre === filtre.slice(0, -1)))
      .filter((l) =>
        compte
          ? l.titre.includes(compte) || l.detail.includes(compte)
          : true,
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 300);
  }, [transactions, transferts, filtre, compte]);

  const filtres: { id: Filtre; label: string }[] = [
    { id: "tout", label: "Tout" },
    { id: "operations", label: "Opérations" },
    { id: "transferts", label: "Transferts" },
    { id: "actions", label: "Gestion" },
  ];

  return (
    <div className="space-y-5">
      <section className="carte space-y-4 p-4">
        <div>
          <h1 className="text-lg font-semibold">Historique des comptes</h1>
          <p className="text-sm text-muted-foreground">
            Toutes les opérations et tous les mouvements effectués avec vos comptes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filtres.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltre(f.id)}
              aria-pressed={filtre === f.id}
              className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                filtre === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="filtre-compte" className="text-xs font-medium text-muted-foreground">
            Filtrer par compte
          </label>
          <select
            id="filtre-compte"
            value={compte}
            onChange={(ev) => setCompte(ev.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Tous les comptes</option>
            {comptes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="carte p-4">
        {lignes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun mouvement à afficher.</p>
        ) : (
          <ul className="space-y-2">
            {lignes.map((l) => (
              <li
                key={l.id}
                className="flex items-start gap-3 rounded-xl border border-border/70 bg-secondary/40 p-3"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {l.genre === "transfert" ? (
                    <ArrowLeftRight className="h-4 w-4" aria-hidden />
                  ) : l.genre === "action" ? (
                    <History className="h-4 w-4" aria-hidden />
                  ) : l.sens === "entree" ? (
                    <ArrowDownLeft className="h-4 w-4" aria-hidden />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium break-words">{l.titre}</span>
                  <span className="block text-xs break-words text-muted-foreground">
                    {formatDateFr(l.date.slice(0, 10))} · {l.detail}
                  </span>
                </span>
                {typeof l.montant === "number" && (
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      l.sens === "entree"
                        ? "text-emerald-600"
                        : l.sens === "sortie"
                          ? "text-destructive"
                          : ""
                    }`}
                  >
                    {l.sens === "entree" ? "+" : l.sens === "sortie" ? "−" : ""}
                    {formatFCFA(l.montant)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
