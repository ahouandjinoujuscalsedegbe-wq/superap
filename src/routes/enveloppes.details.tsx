import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronDown, ChevronRight, History } from "lucide-react";
import { useSuperApp, PERIODES, type Periode, type Enveloppe } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { equivalentMensuel } from "@/lib/periodes";
import { grouperParCategorie, CATEGORIE_LIBRE } from "@/lib/categories";
import { etatEnveloppe } from "@/lib/enveloppe-etat";
import { lireHistoriqueEnveloppes, libelleActionEnveloppe } from "@/lib/historique-enveloppes";

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
  const { enveloppes, depensesParEnveloppe } = useSuperApp();

  const groupes = useMemo(() => grouperParCategorie(enveloppes), [enveloppes]);
  // Le journal est relu volontairement à chaque changement d'enveloppe :
  // c'est le seul signal disponible pour rafraîchir l'historique local.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const journal = useMemo(() => lireHistoriqueEnveloppes().slice(0, 30), [enveloppes]);
  const [journalOuvert, setJournalOuvert] = useState(false);

  return (
    <div className="space-y-5">
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
                    (s, e) => s + etatEnveloppe(e, depensesParEnveloppe[e.id] ?? 0).restant,
                    0,
                  ),
                0,
              );
              const nbEnveloppes = groupe.sousCategories.reduce(
                (somme, sous) => somme + sous.enveloppes.length,
                0,
              );
              const nbSous = groupe.sousCategories.length;

              return (
                <li key={groupe.categorie} className="rounded-xl border border-border/70">
                  <Link
                    to="/enveloppes/categorie/$nom"
                    params={{ nom: groupe.categorie }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-secondary/40 p-4 text-left transition-colors hover:bg-secondary"
                  >
                    <div className="min-w-0">
                      <span className="block font-semibold">
                        {groupe.categorie === CATEGORIE_LIBRE ? "Sans catégorie" : groupe.categorie}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {nbSous} sous-catégorie{nbSous > 1 ? "s" : ""} · {nbEnveloppes} enveloppe
                        {nbEnveloppes > 1 ? "s" : ""} · {formatFCFA(totalRestant)} restants
                      </span>
                    </div>
                    <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="carte p-4">
        <button
          type="button"
          onClick={() => setJournalOuvert((v) => !v)}
          aria-expanded={journalOuvert}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2 text-base font-semibold">
            <History className="h-4 w-4" aria-hidden /> Historique des enveloppes
          </span>
          {journalOuvert ? (
            <ChevronDown aria-hidden className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight aria-hidden className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        {journalOuvert &&
          (journal.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Aucune action enregistrée pour le moment.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {journal.map((entree) => (
                <li
                  key={entree.id}
                  className="rounded-xl border border-border/70 bg-secondary/40 p-3"
                >
                  <p className="text-sm font-medium">
                    {libelleActionEnveloppe(entree.action)} · {entree.enveloppe}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateFr(entree.date.slice(0, 10))} ·{" "}
                    {new Date(entree.date).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {entree.auteur}
                  </p>
                  <p className="mt-1 text-xs break-words">{entree.details}</p>
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}

type Ton = "neutre" | "positif" | "alerte" | "danger";

const classeTon: Record<Ton, string> = {
  neutre: "text-foreground",
  positif: "text-success",
  alerte: "text-amber-600",
  danger: "text-destructive",
};

function Stat({
  libelle,
  aide,
  valeur,
  ton = "neutre",
}: {
  libelle: string;
  aide?: string;
  valeur: string;
  ton?: Ton;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {libelle}
      </dt>
      <dd className={`mt-0.5 text-sm font-bold tabular-nums ${classeTon[ton]}`}>{valeur}</dd>
      {aide && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{aide}</p>}
    </div>
  );
}

export function CarteEnveloppe({
  e,
  estOuverte,
  onToggle,
  sansBoutonDetails = false,
  sansEntete = false,
}: {
  e: Enveloppe;
  estOuverte: boolean;
  onToggle: () => void;
  /** Masque le bouton « Détails » : le contenu détaillé suit directement la carte. */
  sansBoutonDetails?: boolean;
  /** Masque titre et badge : la ligne rabattable au-dessus les affiche déjà. */
  sansEntete?: boolean;
}) {
  const { depensesParEnveloppe, budgets, transactions } = useSuperApp();
  const utilise = depensesParEnveloppe[e.id] ?? 0;
  const etat = etatEnveloppe(e, utilise);
  const pourcentage = etat.pourcentage;
  const depasse = etat.plafondAtteint;
  const planifie = budgets.filter((b) => b.enveloppeId === e.id);
  const prevuMensuel = planifie.reduce((s, b) => s + equivalentMensuel(b), 0);
  const operations = transactions.filter((t) => t.categorie === e.id);

  const couleurBarre = depasse
    ? "bg-destructive"
    : pourcentage >= 80
      ? "bg-amber-500"
      : "bg-success";

  return (
    <>
      {!sansEntete && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-semibold">
              <span aria-hidden className="text-xl">
                {e.emoji}
              </span>
              {e.nom}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                depasse
                  ? "bg-destructive/15 text-destructive"
                  : pourcentage >= 80
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-success/15 text-success"
              }`}
            >
              {Math.round(pourcentage)} % du plafond
            </span>
          </div>
          <div
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full border border-border/40 bg-secondary"
            role="progressbar"
            aria-valuenow={Math.round(pourcentage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Consommation du plafond de l'enveloppe ${e.nom} : ${Math.round(pourcentage)} %`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${couleurBarre}`}
              style={{ width: `${pourcentage}%` }}
            />
          </div>
        </>
      )}

      {depasse && (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Zone rouge : le plafond de {formatFCFA(e.plafond)} est atteint.{" "}
            {etat.reserveDisponible > 0
              ? `Vous puisez désormais dans la réserve : ${formatFCFA(etat.reserveDisponible)} disponibles.`
              : "La réserve de cette enveloppe est épuisée."}
          </span>
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-2">
        <Stat
          libelle="Somme attribuée"
          aide="argent mis dans l'enveloppe"
          valeur={formatFCFA(etat.dotation)}
        />
        <Stat libelle="Plafond" aide="maximum avant alerte" valeur={formatFCFA(e.plafond)} />
        <Stat
          libelle="Dépensé"
          aide="déjà utilisé"
          valeur={formatFCFA(utilise)}
          ton={depasse ? "danger" : pourcentage >= 80 ? "alerte" : "neutre"}
        />
        <Stat
          libelle="Reste avant plafond"
          aide="plafond − dépensé"
          valeur={formatFCFA(etat.avantPlafond)}
          ton={etat.avantPlafond > 0 ? "positif" : "danger"}
        />
        <Stat
          libelle="Réserve"
          aide="marge au-delà du plafond"
          valeur={formatFCFA(etat.reserveDisponible)}
        />
        <Stat
          libelle="Planifié par mois"
          aide={`${planifie.length} dépense${planifie.length > 1 ? "s" : ""} planifiée${planifie.length > 1 ? "s" : ""}`}
          valeur={formatFCFA(prevuMensuel)}
        />
        <Stat
          libelle="Opérations réelles"
          aide="mouvements enregistrés"
          valeur={String(nbOperations)}
        />
      </dl>

      {!sansBoutonDetails && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={estOuverte}
          className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
        >
          <span className="min-w-0 truncate text-left">
            Détails · {formatFCFA(etat.restant)} restants · {Math.round(pourcentage)} %
          </span>
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 shrink-0 transition-transform duration-300 ${estOuverte ? "rotate-180" : ""}`}
          />
        </button>
      )}

      {estOuverte && (
        <div className="mt-3 space-y-4">
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs leading-relaxed text-foreground">
            Lecture : sur <span className="font-semibold">{formatFCFA(etat.dotation)}</span>{" "}
            contenus dans l'enveloppe, <span className="font-semibold">{formatFCFA(utilise)}</span>{" "}
            sont dépensés. Il reste{" "}
            <span className="font-semibold">{formatFCFA(etat.avantPlafond)}</span> avant le plafond,
            puis <span className="font-semibold">{formatFCFA(etat.reserveDisponible)}</span> de
            réserve en plus.
          </p>

          <section className="rounded-lg border border-border/60 bg-background/50 p-3">
            <h3 className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Opérations réelles
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-foreground">
                {nbOperations}
              </span>
            </h3>
            {operations.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Aucune opération réelle pour cette enveloppe.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {operations.slice(0, 20).map((t) => (
                  <li key={t.id} className="rounded-lg border border-border/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs font-medium">{t.libelle}</span>
                      <span
                        className={`shrink-0 text-xs font-bold tabular-nums ${
                          t.type === "revenu" ? "text-success" : "text-foreground"
                        }`}
                      >
                        {t.type === "revenu" ? "+" : "−"}
                        {formatFCFA(t.montant)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDateFr(t.date)} · compte {t.compte}
                    </p>
                  </li>
                ))}
                {operations.length > 20 && (
                  <li className="px-1 text-[11px] text-muted-foreground">
                    Et {operations.length - 20} opération{operations.length - 20 > 1 ? "s" : ""} plus
                    ancienne{operations.length - 20 > 1 ? "s" : ""}…
                  </li>
                )}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-border/60 bg-background/50 p-3">
            <h3 className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dépenses planifiées
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-foreground">
                {planifie.length}
              </span>
            </h3>
            {planifie.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Aucune dépense planifiée dans Budgétisation.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {planifie.map((b) => (
                  <li key={b.id} className="rounded-lg border border-border/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs font-medium">{b.libelle}</span>
                      <span className="shrink-0 text-xs font-bold tabular-nums">
                        {formatFCFA(b.montant)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {libellePeriode(b.periode)} · prochaine : {formatDateFr(b.prochaine)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
