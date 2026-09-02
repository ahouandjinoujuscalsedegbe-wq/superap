import { useMemo, useState } from "react";
import { ChevronLeft, Search, Wallet, X } from "lucide-react";
import type { BilanEnveloppe } from "@/lib/coach-enveloppe";

function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

/**
 * Sélecteur « Conseiller par enveloppe » : un bouton circulaire dans la barre
 * de discussion ouvre un panneau qui monte du bas, avec recherche et liste
 * alphabétique défilante des enveloppes (icône + nom, taille uniforme).
 */
export function SelecteurEnveloppes({
  ouvert,
  onFermer,
  bilans,
  onDemander,
}: {
  ouvert: boolean;
  onFermer: () => void;
  bilans: BilanEnveloppe[];
  onDemander: (question: string) => void;
}) {
  const [recherche, setRecherche] = useState("");
  const [detail, setDetail] = useState<string | null>(null);

  const tries = useMemo(
    () =>
      [...bilans].sort((a, b) =>
        a.enveloppe.nom.localeCompare(b.enveloppe.nom, "fr", { sensitivity: "base" }),
      ),
    [bilans],
  );

  if (!ouvert) return null;

  const filtre = recherche.trim().toLowerCase();
  const affiches = filtre
    ? tries.filter((b) => b.enveloppe.nom.toLowerCase().includes(filtre))
    : tries;
  const courant = detail ? tries.find((b) => b.enveloppe.id === detail) : undefined;

  const fermer = () => {
    setDetail(null);
    setRecherche("");
    onFermer();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-foreground/40 backdrop-blur-sm">
      <button type="button" aria-label="Fermer" onClick={fermer} className="flex-1" />
      <div className="flex max-h-[75vh] animate-montee flex-col rounded-t-3xl bg-background pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        {/* Tête du panneau */}
        <div className="flex items-center gap-2 px-4 pt-4">
          {courant ? (
            <button
              type="button"
              onClick={() => setDetail(null)}
              aria-label="Retour à la liste"
              className="rounded-full p-1.5"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <Wallet className="h-5 w-5 text-primary" aria-hidden />
          )}
          <h2 className="min-w-0 flex-1 truncate text-base font-bold">
            {courant ? courant.enveloppe.nom : "Conseiller par enveloppe"}
          </h2>
          <button type="button" onClick={fermer} aria-label="Fermer" className="rounded-full p-1.5">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {courant ? (
          /* Détail du conseiller de l'enveloppe choisie */
          <div className="space-y-3 overflow-y-auto px-4 pt-3 text-sm">
            <div className="flex items-center gap-3">
              <span
                className="grid h-12 w-12 place-items-center rounded-full bg-muted text-2xl"
                aria-hidden
              >
                {courant.enveloppe.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{courant.enveloppe.nom}</p>
                <p className="truncate text-xs text-muted-foreground">{courant.resume}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${
                  courant.score >= 70
                    ? "bg-success/15 text-success"
                    : courant.score >= 40
                      ? "bg-accent/30 text-foreground"
                      : "bg-destructive/15 text-destructive"
                }`}
              >
                {courant.score}/100
              </span>
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Dépensé sur 30 jours : {fcfa(courant.depense30)}</li>
              <li>
                • Mois précédent : {fcfa(courant.depense30Avant)}
                {courant.tendance !== 0 &&
                  ` (${courant.tendance > 0 ? "+" : ""}${Math.round(courant.tendance)} %)`}
              </li>
              <li>• Rythme observé : {fcfa(courant.rythmeJour)} par jour</li>
              <li>• Opérations analysées : {courant.operations}</li>
            </ul>
            {courant.conseils.map((c) => (
              <div key={c.id} className="rounded-xl bg-muted/50 p-3 text-xs">
                <p className="font-medium text-foreground">{c.texte}</p>
                <p className="mt-1 text-muted-foreground">À faire : {c.action}</p>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                onDemander(`Où en est mon enveloppe ${courant.enveloppe.nom} ?`);
                fermer();
              }}
              className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
            >
              En parler dans la discussion
            </button>
          </div>
        ) : (
          <>
            {/* Loupe de recherche en tête de liste */}
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher une enveloppe…"
                aria-label="Rechercher une enveloppe"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {recherche && (
                <button
                  type="button"
                  onClick={() => setRecherche("")}
                  aria-label="Effacer la recherche"
                >
                  <X className="h-4 w-4 text-muted-foreground" aria-hidden />
                </button>
              )}
            </div>

            {/* Liste alphabétique défilante */}
            <div className="mt-3 flex-1 space-y-1 overflow-y-auto px-4">
              {affiches.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Aucune enveloppe trouvée.
                </p>
              )}
              {affiches.map((b) => (
                <button
                  key={b.enveloppe.id}
                  type="button"
                  onClick={() => setDetail(b.enveloppe.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2.5 text-left active:scale-[0.99]"
                >
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-xl"
                    aria-hidden
                  >
                    {b.enveloppe.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{b.enveloppe.nom}</span>
                    <span className="block truncate text-xs text-muted-foreground">{b.resume}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${
                      b.score >= 70
                        ? "bg-success/15 text-success"
                        : b.score >= 40
                          ? "bg-accent/30 text-foreground"
                          : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {b.score}/100
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
