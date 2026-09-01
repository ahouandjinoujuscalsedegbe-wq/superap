import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Copy, FileDown, TrendingDown, TrendingUp } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { useCerveau } from "@/lib/cerveau/hook";
import { SectionIaLocale } from "@/components/SectionIaLocale";
import { BoutonVocalisation } from "@/components/BoutonVocalisation";
import { Link } from "@tanstack/react-router";
import { formatDateFr, formatFCFA } from "@/lib/format";
import {
  FENETRES,
  comparerCategories,
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


const COULEUR_NIVEAU = {
  alerte: "border-destructive/40 bg-destructive/10",
  attention: "border-primary/40 bg-primary/10",
  bon: "border-success/40 bg-success/10",
} as const;

const ICONE_NIVEAU = { alerte: "🚨", attention: "⚠️", bon: "✅" } as const;

export function FicheAnalyses() {
  const { transactions, enveloppes, depensesParEnveloppe, dettes, budgets, solde } = useSuperApp();
  const cerveau = useCerveau();
  const [fenetre, setFenetre] = useState<Fenetre>("mois");
  const [categorieOuverte, setCategorieOuverte] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [objectif, setObjectif] = useState(0);

  useEffect(() => {
    const brut = window.localStorage.getItem("superapp:objectif-epargne");
    if (brut) setObjectif(Number(brut) || 0);
  }, []);

  const enregistrerObjectif = (valeur: number) => {
    setObjectif(valeur);
    window.localStorage.setItem("superapp:objectif-epargne", String(valeur));
  };

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
  // Anomalies et enveloppes à surveiller : fournies par le noyau unique
  // (src/lib/cerveau) pour que tous les écrans annoncent les mêmes chiffres.
  const anomalies = useMemo(
    () =>
      cerveau.faits.inhabituelles.slice(0, 5).map((a) => ({
        transaction: a.transaction,
        enveloppe:
          enveloppes.find((e) => e.id === a.transaction.categorie) !== undefined
            ? `${enveloppes.find((e) => e.id === a.transaction.categorie)?.emoji} ${enveloppes.find((e) => e.id === a.transaction.categorie)?.nom}`
            : a.transaction.categorie,
        moyenne: a.habituel,
        facteur: a.facteur,
      })),
    [cerveau, enveloppes],
  );
  const alertes = useMemo(
    () =>
      cerveau.faits.enveloppes
        .filter(
          (e) =>
            e.plafondAtteint ||
            e.pourcentage >= 70 ||
            (e.joursAvantEpuisement !== null && e.joursAvantEpuisement <= 15),
        )
        .sort((a, b) => b.pourcentage - a.pourcentage)
        .map((e) => ({ ...e, joursRestants: e.joursAvantEpuisement })),
    [cerveau],
  );


  const douzeMois = useMemo(() => comparaisonMensuelle(transactions, 12), [transactions]);
  const joursSemaine = useMemo(() => analyseJoursSemaine(periode), [periode]);
  const realisation = useMemo(
    () => tauxRealisationBudgets(budgets, transactions, enveloppes),
    [budgets, transactions, enveloppes],
  );
  const sources = useMemo(() => revenusParSource(periode), [periode]);
  const recurrentes = useMemo(() => depensesRecurrentes(transactions), [transactions]);
  const moyenne = useMemo(() => comparerALaMoyenne(transactions, 6), [transactions]);
  const scores = useMemo(() => historiqueScores(transactions, 6), [transactions]);
  const objectifSuivi = useMemo(
    () => suivreObjectifEpargne(transactions, objectif),
    [transactions, objectif],
  );
  const camembert = useMemo(() => degradeCirculaire(repartition), [repartition]);

  const maxMois = Math.max(1, ...douzeMois.map((m) => Math.max(m.revenus, m.depenses)));
  const maxJour = Math.max(1, ...joursSemaine.map((j) => j.montant));

  const evolution = variation(totaux.depenses, precedents.depenses);

  const rapportComplet = () => {
    const f = (n: number) => formatFCFA(n);
    const base = resumeTexte({
      fenetre: FENETRES.find((x) => x.id === fenetre)?.label ?? "",
      diagnostic,
      totaux,
      projection: projection.projection,
      repartition,
    });
    const extras = [
      "",
      "Sources de revenus :",
      ...(sources.length > 0
        ? sources.map((s) => `- ${s.nom} : ${f(s.montant)} (${s.part} %)`)
        : ["- Aucune"]),
      "",
      `Réalisation des budgets planifiés : ${realisation.tauxGlobal} %`,
      ...realisation.lignes
        .slice(0, 8)
        .map((l) => `- ${l.libelle} : prévu ${f(l.prevu)} / réalisé ${f(l.realise)} (${l.taux} %)`),
      "",
      "Dépenses récurrentes :",
      ...(recurrentes.length > 0
        ? recurrentes
            .slice(0, 6)
            .map((r) => `- ${r.libelle} : ${r.occurrences} fois, moyenne ${f(r.montantMoyen)}`)
        : ["- Aucune détectée"]),
      "",
      `Comparaison à la moyenne (${moyenne.moisComptes} mois) : ${f(moyenne.moisCourant)} contre ${f(
        moyenne.moyenne,
      )}`,
      objectif > 0
        ? `Objectif d'épargne : ${f(objectifSuivi.epargneReelle)} / ${f(objectif)} (${objectifSuivi.progression} %)`
        : "Objectif d'épargne : non défini",
      "",
      "Historique du score :",
      ...scores.map((s) => `- ${s.label} : ${s.score}/100`),
    ];
    return `${base}\n${extras.join("\n")}`;
  };
  /** Résumé court, pensé pour l'oreille : chiffres clés, alertes, conseils. */
  const resumeParle = () => {
    const f = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} francs CFA`;
    const lignes = [
      `Analyse ${FENETRES.find((x) => x.id === fenetre)?.label ?? ""}.`,
      `Votre score de santé financière est de ${diagnostic.score} sur 100, ${diagnostic.mention}.`,
      `Revenus ${f(totaux.revenus)}, dépenses ${f(totaux.depenses)}, solde ${f(totaux.net)}.`,
      `Projection de fin de mois : ${f(projection.projection)}.`,
    ];
    const top = repartition.slice(0, 3);
    if (top.length > 0) {
      lignes.push(
        `Principales dépenses : ${top.map((c) => `${c.nom}, ${c.part} pour cent`).join(" ; ")}.`,
      );
    }
    if (alertes.length > 0) {
      lignes.push(`${alertes.length} alerte${alertes.length > 1 ? "s" : ""} sur vos enveloppes.`);
      for (const a of alertes.slice(0, 4)) {
        lignes.push(
          a.plafondAtteint
            ? `${a.nom} : plafond atteint, il reste ${f(a.restant)}.`
            : `${a.nom} : ${a.pourcentage} pour cent utilisés, il reste ${f(a.restant)}${
                a.joursRestants !== null ? `, soit environ ${a.joursRestants} jours` : ""
              }.`,
        );
      }
    } else {
      lignes.push("Aucune alerte sur vos enveloppes.");
    }
    for (const c of diagnostic.conseils.slice(0, 3)) lignes.push(`Conseil : ${c.titre}. ${c.texte}`);
    return lignes.join(" ");
  };

  const tauxEpargne = totaux.revenus > 0 ? Math.round((totaux.net / totaux.revenus) * 100) : 0;
  const maxTendance = Math.max(1, ...tendance.map((m) => Math.max(m.revenus, m.depenses)));

  return (
    <div className="space-y-5">

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

      <Link
        to="/enveloppes/budgetisation"
        className="carte flex items-center justify-between gap-3 p-4 text-sm font-semibold"
      >
        Ouvrir la proposition de budget
        <span aria-hidden>→</span>
      </Link>

      <SectionIaLocale transactions={transactions} enveloppes={enveloppes} solde={solde} />



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
        {repartition.length > 0 && (
          <div className="flex items-center gap-4">
            <div
              className="relative h-28 w-28 shrink-0 rounded-full"
              style={{ background: camembert }}
              role="img"
              aria-label="Graphique circulaire de la répartition des dépenses"
            >
              <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-card text-center">
                <span className="text-[10px] text-muted-foreground">Total</span>
                <span className="text-[11px] font-bold">{formatFCFA(totaux.depenses)}</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1 text-xs">
              {repartition.slice(0, 6).map((c, i) => (
                <li key={c.nom} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: COULEURS_SECTEURS[i % COULEURS_SECTEURS.length] }}
                    aria-hidden
                  />
                  <span className="truncate">{c.nom}</span>
                  <span className="ml-auto shrink-0 font-semibold">{c.part} %</span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
            Aucune planification ni dépense ce mois-ci. Planifiez vos dépenses dans la Budgétisation
            pour activer cette comparaison.
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
                  {e.pourcentage !== null
                    ? ` (${e.pourcentage > 0 ? "+" : ""}${e.pourcentage} %)`
                    : ""}
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

      <section className="carte space-y-3 p-4">
        <h2 className="font-semibold">Comparaison des 12 derniers mois</h2>
        <div className="flex items-end justify-between gap-1">
          {douzeMois.map((m) => (
            <div key={m.mois} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-20 w-full items-end justify-center gap-[2px]">
                <div
                  className="w-1.5 rounded-t bg-success"
                  style={{ height: `${(m.revenus / maxMois) * 100}%` }}
                  title={`Revenus : ${formatFCFA(m.revenus)}`}
                />
                <div
                  className="w-1.5 rounded-t bg-destructive"
                  style={{ height: `${(m.depenses / maxMois) * 100}%` }}
                  title={`Dépenses : ${formatFCFA(m.depenses)}`}
                />
              </div>
              <span className="text-[8px] text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
        <ul className="divide-y divide-border text-xs">
          {douzeMois
            .filter((m) => m.revenus > 0 || m.depenses > 0)
            .slice(-4)
            .reverse()
            .map((m) => (
              <li key={m.mois} className="flex items-center justify-between gap-2 py-1.5">
                <span className="font-medium">{m.label}</span>
                <span className="text-muted-foreground">
                  {formatFCFA(m.revenus)} / {formatFCFA(m.depenses)}
                </span>
                <span
                  className={`font-semibold ${m.net >= 0 ? "text-success" : "text-destructive"}`}
                >
                  {m.net >= 0 ? "+" : ""}
                  {formatFCFA(m.net)}
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Vos jours de dépense</h2>
        {joursSemaine.every((j) => j.montant === 0) ? (
          <p className="text-sm text-muted-foreground">
            Aucune dépense sur cette période pour analyser les jours de la semaine.
          </p>
        ) : (
          <>
            <ul className="space-y-1.5 text-sm">
              {joursSemaine.map((j) => (
                <li key={j.index} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs">{j.nom}</span>
                  <span className="h-2 flex-1 rounded-full bg-muted">
                    <span
                      className="block h-2 rounded-full bg-primary"
                      style={{ width: `${(j.montant / maxJour) * 100}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right text-xs font-semibold">{j.part} %</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Jour le plus dépensier :{" "}
              <strong>
                {[...joursSemaine].sort((a, b) => b.montant - a.montant)[0]?.nom ?? "—"}
              </strong>
              .
            </p>
          </>
        )}
      </section>

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Réalisation des budgets planifiés</h2>
        {realisation.lignes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun budget planifié. Rendez-vous dans Enveloppes → Budgétisation.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Taux global de réalisation : <strong>{realisation.tauxGlobal} %</strong>
            </p>
            <ul className="space-y-2 text-sm">
              {realisation.lignes.slice(0, 8).map((l) => (
                <li key={l.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{l.libelle}</span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        l.taux > 100 ? "text-destructive" : "text-primary"
                      }`}
                    >
                      {l.taux} %
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full ${l.taux > 100 ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, l.taux)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {l.enveloppe} · prévu {formatFCFA(l.prevu)} · réalisé {formatFCFA(l.realise)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Vos sources de revenus</h2>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun revenu sur cette période.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {sources.map((s) => (
              <li key={s.nom} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {s.nom} <span className="text-xs text-muted-foreground">({s.operations})</span>
                </span>
                <span className="shrink-0 font-semibold text-success">
                  {formatFCFA(s.montant)} · {s.part} %
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recurrentes.length > 0 && (
        <section className="carte space-y-2 p-4">
          <h2 className="font-semibold">Dépenses récurrentes détectées</h2>
          <ul className="divide-y divide-border text-sm">
            {recurrentes.slice(0, 6).map((r) => (
              <li key={r.libelle} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.libelle}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.occurrences} fois · moyenne {formatFCFA(r.montantMoyen)} · dernière le{" "}
                    {formatDateFr(r.derniere)}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-destructive">
                  {formatFCFA(r.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Comparaison à votre moyenne</h2>
        {moyenne.moisComptes === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pas encore assez d'historique pour calculer une moyenne mensuelle.
          </p>
        ) : (
          <p className="text-sm">
            Ce mois-ci : <strong>{formatFCFA(moyenne.moisCourant)}</strong> · moyenne des{" "}
            {moyenne.moisComptes} derniers mois : <strong>{formatFCFA(moyenne.moyenne)}</strong>.
            <br />
            <span
              className={`font-semibold ${moyenne.ecart > 0 ? "text-destructive" : "text-success"}`}
            >
              {moyenne.ecart > 0 ? "+" : ""}
              {formatFCFA(moyenne.ecart)}
              {moyenne.pourcentage !== null
                ? ` (${moyenne.pourcentage > 0 ? "+" : ""}${moyenne.pourcentage} %)`
                : ""}
            </span>{" "}
            par rapport à votre habitude.
          </p>
        )}
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="font-semibold">Objectif d'épargne du mois</h2>
        <label className="block text-xs text-muted-foreground" htmlFor="objectif-epargne">
          Montant que vous souhaitez épargner ce mois-ci (FCFA)
        </label>
        <input
          id="objectif-epargne"
          inputMode="numeric"
          value={objectif === 0 ? "" : String(objectif)}
          onChange={(e) => enregistrerObjectif(Number(e.target.value.replace(/\D/g, "")) || 0)}
          placeholder="Ex. 50000"
          className="w-full rounded-xl border border-border bg-background p-3 text-sm"
        />
        {objectif > 0 && (
          <>
            <div className="h-2 rounded-full bg-muted">
              <div
                className={`h-2 rounded-full ${
                  objectifSuivi.atteint ? "bg-success" : "bg-primary"
                }`}
                style={{ width: `${Math.min(100, objectifSuivi.progression)}%` }}
              />
            </div>
            <p className="text-sm">
              Épargne réelle : <strong>{formatFCFA(objectifSuivi.epargneReelle)}</strong> ·{" "}
              {objectifSuivi.progression} % de l'objectif.{" "}
              {objectifSuivi.atteint
                ? "🎉 Objectif atteint, bravo !"
                : `Il reste ${formatFCFA(objectifSuivi.manque)} à épargner.`}
            </p>
          </>
        )}
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="font-semibold">Historique du score de santé</h2>
        <div className="flex items-end justify-between gap-2">
          {scores.map((s) => (
            <div key={s.mois} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-semibold">{s.score}</span>
              <div className="flex h-20 w-full items-end justify-center">
                <div
                  className={`w-3 rounded-t ${
                    s.score >= 60 ? "bg-success" : s.score >= 40 ? "bg-primary" : "bg-destructive"
                  }`}
                  style={{ height: `${s.score}%` }}
                  title={`${s.label} : ${s.score}/100`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Score mensuel calculé à partir de votre taux d'épargne du mois.
        </p>
      </section>

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

      <div className="space-y-2">
        <BoutonVocalisation
          texte={resumeParle}
          libelle="Écouter l'analyse et les alertes"
          className="w-full p-3"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(rapportComplet());
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
        <button
          type="button"
          onClick={() =>
            exporterRapportPdf(
              `Rapport financier — ${FENETRES.find((f) => f.id === fenetre)?.label ?? ""}`,
              rapportComplet(),
            )
          }
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground"
        >
          <FileDown className="h-4 w-4" aria-hidden />
          Exporter le rapport en PDF
        </button>
      </div>
    </div>
  );
}
