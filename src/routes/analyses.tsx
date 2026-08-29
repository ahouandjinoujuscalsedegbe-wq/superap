import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown, Copy, TrendingDown, TrendingUp } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatDateFr, formatFCFA } from "@/lib/format";
import {
  FENETRES,
  alertesEnveloppes,
  comparerCategories,
  detecterAnomalies,
  diagnostiquer,
  filtrerFenetre,
  filtrerFenetrePrecedente,
  plusGrossesDepenses,
  prevuContreReel,
  projectionFinDeMois,
  resumeTexte,
  repartitionParCategorie,
  tendanceMensuelle,
  totaliser,
  variation,
  type Fenetre,
} from "@/lib/intelligence";
import {
  COULEURS_SECTEURS,
  analyseJoursSemaine,
  comparaisonMensuelle,
  comparerALaMoyenne,
  degradeCirculaire,
  depensesRecurrentes,
  exporterRapportPdf,
  historiqueScores,
  revenusParSource,
  suivreObjectifEpargne,
  tauxRealisationBudgets,
} from "@/lib/intelligence-plus";

export const Route = createFileRoute("/analyses")({
  head: () => ({
    meta: [
      { title: "Analyses et Conseils — Intelligence financière du foyer" },
      {
        name: "description",
        content:
          "Score de santé financière, répartition des dépenses par catégorie, tendance sur 6 mois et conseils personnalisés en francs CFA.",
      },
      { property: "og:title", content: "Analyses et Conseils — SUPER APP" },
      {
        property: "og:description",
        content:
          "Score de santé, tendances, projection de fin de mois et conseils pour le budget du foyer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Analyses,
});

const COULEUR_NIVEAU = {
  alerte: "border-destructive/40 bg-destructive/10",
  attention: "border-primary/40 bg-primary/10",
  bon: "border-success/40 bg-success/10",
} as const;

const ICONE_NIVEAU = { alerte: "🚨", attention: "⚠️", bon: "✅" } as const;

function Analyses() {
  const {
    transactions,
    enveloppes,
    depensesParEnveloppe,
    dettes,
    budgets,
    solde,
  } = useSuperApp();
  const [fenetre, setFenetre] = useState<Fenetre>("mois");
  const [categorieOuverte, setCategorieOuverte] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  const periode = useMemo(() => filtrerFenetre(transactions, fenetre), [transactions, fenetre]);
  const precedente = useMemo(
    () => filtrerFenetrePrecedente(transactions, fenetre),
    [transactions, fenetre],
  );
  const totaux = useMemo(() => totaliser(periode), [periode]);
  const precedents = useMemo(() => totaliser(precedente), [precedente]);
  const repartition = useMemo(
    () => repartitionParCategorie(periode, enveloppes),
    [periode, enveloppes],
  );
  const projection = useMemo(() => projectionFinDeMois(transactions), [transactions]);
  const tendance = useMemo(() => tendanceMensuelle(transactions), [transactions]);
  const grosses = useMemo(() => plusGrossesDepenses(periode), [periode]);
  const diagnostic = useMemo(
    () =>
      diagnostiquer({
        totaux,
        precedents,
        enveloppes,
        depensesParEnveloppe,
        dettes,
        budgets,
        solde,
      }),
    [totaux, precedents, enveloppes, depensesParEnveloppe, dettes, budgets, solde],
  );

  const evolutions = useMemo(
    () => comparerCategories(periode, precedente, enveloppes),
    [periode, precedente, enveloppes],
  );
  const prevuReel = useMemo(
    () => prevuContreReel(budgets, transactions, enveloppes),
    [budgets, transactions, enveloppes],
  );
  const anomalies = useMemo(
    () => detecterAnomalies(periode, enveloppes),
    [periode, enveloppes],
  );
  const alertes = useMemo(
    () => alertesEnveloppes(enveloppes, depensesParEnveloppe, transactions),
    [enveloppes, depensesParEnveloppe, transactions],
  );

  const evolution = variation(totaux.depenses, precedents.depenses);
  const tauxEpargne = totaux.revenus > 0 ? Math.round((totaux.net / totaux.revenus) * 100) : 0;
  const maxTendance = Math.max(
    1,
    ...tendance.map((m) => Math.max(m.revenus, m.depenses)),
  );

  return (
    <div className="space-y-5">
      <header className="pr-12">
        <h1 className="text-2xl font-bold tracking-tight">Analyses et Conseils</h1>
        <p className="text-sm text-muted-foreground">
          Votre intelligence financière : comprendre, anticiper, décider.
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FENETRES.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFenetre(f.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              fenetre === f.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="carte space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Santé financière</p>
            <p className="text-3xl font-bold text-primary">{diagnostic.score}/100</p>
            <p className="text-xs font-semibold text-muted-foreground">{diagnostic.mention}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Taux d'épargne</p>
            <p className="text-xl font-bold">{tauxEpargne} %</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${diagnostic.score}%` }}
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="carte p-4">
          <p className="text-xs text-muted-foreground">Revenus de la période</p>
          <p className="mt-1 text-lg font-bold text-success">{formatFCFA(totaux.revenus)}</p>
        </div>
        <div className="carte p-4">
          <p className="text-xs text-muted-foreground">Dépenses de la période</p>
          <p className="mt-1 text-lg font-bold text-destructive">{formatFCFA(totaux.depenses)}</p>
          {evolution !== null && (
            <p
              className={`mt-1 flex items-center gap-1 text-xs font-semibold ${
                evolution > 0 ? "text-destructive" : "text-success"
              }`}
            >
              {evolution > 0 ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden />
              )}
              {evolution > 0 ? "+" : ""}
              {evolution} % vs période précédente
            </p>
          )}
        </div>
      </section>

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Projection de fin de mois</h2>
        <p className="text-sm text-muted-foreground">
          Déjà dépensé : <strong>{formatFCFA(projection.dejaDepense)}</strong> · moyenne{" "}
          <strong>{formatFCFA(projection.moyenneJour)}</strong> par jour.
        </p>
        <p className="text-sm">
          À ce rythme, vous finirez le mois autour de{" "}
          <strong className="text-primary">{formatFCFA(projection.projection)}</strong> de dépenses
          ({projection.joursRestants} jour(s) restant(s)).
        </p>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="font-semibold">Tendance sur 6 mois</h2>
        <div className="flex items-end justify-between gap-2">
          {tendance.map((m) => (
            <div key={m.mois} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end justify-center gap-1">
                <div
                  className="w-2.5 rounded-t bg-success"
                  style={{ height: `${(m.revenus / maxTendance) * 100}%` }}
                  title={`Revenus : ${formatFCFA(m.revenus)}`}
                />
                <div
                  className="w-2.5 rounded-t bg-destructive"
                  style={{ height: `${(m.depenses / maxTendance) * 100}%` }}
                  title={`Dépenses : ${formatFCFA(m.depenses)}`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Barre verte : revenus · barre rouge : dépenses.
        </p>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="font-semibold">Répartition par catégorie</h2>
        {repartition.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune dépense enregistrée sur cette période.
          </p>
        ) : (
          repartition.map((c) => {
            const ouvert = categorieOuverte === c.nom;
            return (
              <div key={c.nom} className="rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setCategorieOuverte(ouvert ? null : c.nom)}
                  aria-expanded={ouvert}
                  className="w-full space-y-1.5 p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">{c.nom}</span>
                    <span className="flex items-center gap-1">
                      {formatFCFA(c.montant)} · {c.part} %
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${ouvert ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(c.part, 100)}%` }}
                    />
                  </div>
                </button>
                {ouvert && (
                  <ul className="space-y-1 border-t border-border p-3 text-sm">
                    {c.enveloppes.map((e) => (
                      <li key={e.nom} className="flex justify-between gap-2">
                        <span className="truncate">
                          {e.emoji} {e.nom}
                        </span>
                        <span className="font-semibold">{formatFCFA(e.montant)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </section>

      {grosses.length > 0 && (
        <section className="carte space-y-2 p-4">
          <h2 className="font-semibold">Vos plus grosses dépenses</h2>
          <ul className="divide-y divide-border text-sm">
            {grosses.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.libelle}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.compte} · {formatDateFr(t.date)}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-destructive">
                  {formatFCFA(t.montant)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {alertes.length > 0 && (
        <section className="carte space-y-2 p-4">
          <h2 className="font-semibold">Enveloppes à surveiller</h2>
          <ul className="space-y-2 text-sm">
            {alertes.map((a) => (
              <li key={a.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    {a.emoji} {a.nom}
                  </span>
                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      a.plafondAtteint ? "text-destructive" : "text-primary"
                    }`}
                  >
                    {a.pourcentage} % du plafond
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full ${a.plafondAtteint ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${Math.min(100, a.pourcentage)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reste {formatFCFA(a.restant)}
                  {a.joursRestants !== null
                    ? ` · épuisement estimé dans ${a.joursRestants} jour(s)`
                    : ""}
                  {a.plafondAtteint ? " · zone rouge : vous puisez dans la réserve." : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Budget prévu contre dépenses réelles (ce mois)</h2>
        {prevuReel.lignes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune planification ni dépense ce mois-ci. Planifiez vos dépenses dans la
            Budgétisation pour activer cette comparaison.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Prévu <strong>{formatFCFA(prevuReel.totalPrevu)}</strong> · réel{" "}
              <strong>{formatFCFA(prevuReel.totalReel)}</strong>
            </p>
            <ul className="space-y-2 text-sm">
              {prevuReel.lignes.map((l) => (
                <li key={l.enveloppeId} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {l.emoji} {l.nom}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        l.ecart > 0 ? "text-destructive" : "text-success"
                      }`}
                    >
                      {l.ecart > 0 ? "+" : ""}
                      {formatFCFA(l.ecart)}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary/50"
                        style={{
                          width: `${Math.min(100, (l.prevu / Math.max(l.prevu, l.reel, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-destructive"
                        style={{
                          width: `${Math.min(100, (l.reel / Math.max(l.prevu, l.reel, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prévu {formatFCFA(l.prevu)} · réel {formatFCFA(l.reel)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {evolutions.length > 0 && fenetre !== "tout" && (
        <section className="carte space-y-2 p-4">
          <h2 className="font-semibold">Ce qui a le plus changé</h2>
          <ul className="divide-y divide-border text-sm">
            {evolutions.slice(0, 5).map((e) => (
              <li key={e.nom} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFCFA(e.precedent)} → {formatFCFA(e.actuel)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs font-semibold ${
                    e.ecart > 0 ? "text-destructive" : "text-success"
                  }`}
                >
                  {e.ecart > 0 ? "+" : ""}
                  {formatFCFA(e.ecart)}
                  {e.pourcentage !== null ? ` (${e.pourcentage > 0 ? "+" : ""}${e.pourcentage} %)` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {anomalies.length > 0 && (
        <section className="carte space-y-2 p-4">
          <h2 className="font-semibold">Dépenses inhabituelles</h2>
          <ul className="divide-y divide-border text-sm">
            {anomalies.map((a) => (
              <li key={a.transaction.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">{a.transaction.libelle}</p>
                  <span className="shrink-0 font-semibold text-destructive">
                    {formatFCFA(a.transaction.montant)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.enveloppe} · {formatDateFr(a.transaction.date)} · {a.facteur}× la moyenne
                  habituelle ({formatFCFA(a.moyenne)})
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="px-1 font-semibold">Conseils personnalisés</h2>
        {diagnostic.conseils.map((c) => (
          <article key={c.id} className={`rounded-xl border p-3 ${COULEUR_NIVEAU[c.niveau]}`}>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden>{ICONE_NIVEAU[c.niveau]}</span>
              {c.titre}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{c.texte}</p>
          </article>
        ))}
      </section>

      <button
        type="button"
        onClick={async () => {
          const texte = resumeTexte({
            fenetre: FENETRES.find((f) => f.id === fenetre)?.label ?? "",
            diagnostic,
            totaux,
            projection: projection.projection,
            repartition,
          });
          try {
            await navigator.clipboard.writeText(texte);
            setCopie(true);
            window.setTimeout(() => setCopie(false), 2500);
          } catch {
            setCopie(false);
          }
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-semibold"
      >
        {copie ? (
          <Check className="h-4 w-4 text-success" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        {copie ? "Rapport copié" : "Copier le rapport d'analyse"}
      </button>
    </div>
  );
}
