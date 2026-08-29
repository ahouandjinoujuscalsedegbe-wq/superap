import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useSuperApp, PERIODES, type Periode, type Enveloppe } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { equivalentMensuel } from "@/lib/periodes";
import { BoutonRetour } from "@/components/BoutonRetour";
import { grouperParCategorie, CATEGORIE_LIBRE } from "@/lib/categories";

const libellePeriode = (p: Periode) => PERIODES.find((x) => x.id === p)?.label ?? p;

export const Route = createFileRoute("/enveloppes/details")({
  head: () => ({
    meta: [
      { title: "Détails actuels — Paramètres des enveloppes en FCFA" },
      {
        name: "description",
        content:
          "Consultez les détails actuels de chaque enveloppe budgétaire : plafond, contenu, reste disponible et budget prévu en francs CFA.",
      },
      { property: "og:title", content: "Détails actuels — SUPER APP" },
      {
        property: "og:description",
        content: "Vue détaillée des enveloppes, de leurs paramètres et de leur contenu en FCFA.",
      },
    ],
  }),
  component: DetailsActuels,
});

function DetailsActuels() {
  const { enveloppes, depensesParEnveloppe, budgets, transactions } = useSuperApp();
  const [categorieOuverte, setCategorieOuverte] = useState<string | null>(null);
  const [enveloppeOuverte, setEnveloppeOuverte] = useState<string | null>(null);

  const groupes = useMemo(() => grouperParCategorie(enveloppes), [enveloppes]);

  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/" label="Retour aux enveloppes" />
      <section className="carte space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold">Détails actuels</h2>
          <p className="text-sm text-muted-foreground">
            Les enveloppes classées par catégorie et sous-catégorie.
          </p>
        </div>

        {enveloppes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune enveloppe pour le moment.</p>
        ) : (
          <ul className="space-y-3">
            {groupes.map((groupe) => {
              const totalRestant = groupe.sousCategories.reduce(
                (somme, sous) =>
                  somme +
                  sous.enveloppes.reduce(
                    (s, e) => s + Math.max(0, e.plafond - (depensesParEnveloppe[e.id] ?? 0)),
                    0,
                  ),
                0,
              );
              const nbEnveloppes = groupe.sousCategories.reduce(
                (somme, sous) => somme + sous.enveloppes.length,
                0,
              );
              const estOuverte = categorieOuverte === groupe.categorie;

              return (
                <li key={groupe.categorie} className="rounded-xl border border-border/70">
                  <button
                    type="button"
                    onClick={() =>
                      setCategorieOuverte(estOuverte ? null : groupe.categorie)
                    }
                    aria-expanded={estOuverte}
                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-secondary/40 p-4 text-left transition-colors hover:bg-secondary"
                  >
                    <div className="min-w-0">
                      <span className="block font-semibold">
                        {groupe.categorie === CATEGORIE_LIBRE
                          ? "Sans catégorie"
                          : groupe.categorie}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {nbEnveloppes} enveloppe{nbEnveloppes > 1 ? "s" : ""} ·{" "}
                        {formatFCFA(totalRestant)} restants
                      </span>
                    </div>
                    <ChevronDown
                      aria-hidden
                      className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ${
                        estOuverte ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {estOuverte && (
                    <div className="space-y-4 border-t border-border/70 p-4">
                      {groupe.sousCategories.map((sous) => (
                        <div key={sous.sousCategorie}>
                          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                            {sous.sousCategorie}
                          </h3>
                          <ul className="space-y-3">
                            {sous.enveloppes.map((e) => (
                              <li
                                key={e.id}
                                className="rounded-xl border border-border/70 p-4"
                              >
                                <CarteEnveloppe
                                  e={e}
                                  estOuverte={enveloppeOuverte === e.id}
                                  onToggle={() =>
                                    setEnveloppeOuverte(
                                      enveloppeOuverte === e.id ? null : e.id,
                                    )
                                  }
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function CarteEnveloppe({
  e,
  estOuverte,
  onToggle,
}: {
  e: Enveloppe;
  estOuverte: boolean;
  onToggle: () => void;
}) {
  const { depensesParEnveloppe, budgets, transactions } = useSuperApp();
  const utilise = depensesParEnveloppe[e.id] ?? 0;
  const pourcentage = e.plafond > 0 ? Math.min(100, (utilise / e.plafond) * 100) : 0;
  const depasse = utilise > e.plafond;
  const planifie = budgets.filter((b) => b.enveloppeId === e.id);
  const prevuMensuel = planifie.reduce((s, b) => s + equivalentMensuel(b), 0);
  const operations = transactions.filter((t) => t.categorie === e.id);
  const nbOperations = operations.length;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="text-xl">
            {e.emoji}
          </span>
          {e.nom}
        </span>
        <span
          className={`text-sm font-semibold ${
            depasse ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {formatFCFA(Math.max(0, e.plafond - utilise))} restants
        </span>
      </div>
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={Math.round(pourcentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Consommation de l'enveloppe ${e.nom}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            depasse ? "bg-destructive" : "bg-primary"
          }`}
          style={{ width: `${pourcentage}%` }}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline">Plafond : </dt>
          <dd className="inline font-medium text-foreground">{formatFCFA(e.plafond)}</dd>
        </div>
        <div>
          <dt className="inline">Dépensé : </dt>
          <dd className="inline font-medium text-foreground">{formatFCFA(utilise)}</dd>
        </div>
        <div>
          <dt className="inline">Dépenses planifiées : </dt>
          <dd className="inline font-medium text-foreground">
            {planifie.length} · {formatFCFA(prevuMensuel)}/mois
          </dd>
        </div>
        <div>
          <dt className="inline">Opérations réelles : </dt>
          <dd className="inline font-medium text-foreground">{nbOperations}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={estOuverte}
        className="mt-3 flex w-full items-center justify-between rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
      >
        Détails des opérations
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 transition-transform duration-300 ${estOuverte ? "rotate-180" : ""}`}
        />
      </button>

      {estOuverte && (
        <div className="mt-3 space-y-4 rounded-lg bg-secondary/30 p-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Opérations réelles
            </h3>
            {operations.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Aucune opération réelle pour cette enveloppe.
              </p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {operations.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate">
                      {formatDateFr(t.date)} · {t.libelle}
                      <span className="text-muted-foreground"> · {t.compte}</span>
                    </span>
                    <span
                      className={`shrink-0 font-medium ${
                        t.type === "revenu" ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {t.type === "revenu" ? "+" : "−"}
                      {formatFCFA(t.montant)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dépenses planifiées
            </h3>
            {planifie.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Aucune dépense planifiée dans Budgétisation.
              </p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {planifie.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate">
                      {b.libelle}
                      <span className="text-muted-foreground">
                        {" "}
                        · {libellePeriode(b.periode)} · prochaine : {formatDateFr(b.prochaine)}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium">{formatFCFA(b.montant)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
