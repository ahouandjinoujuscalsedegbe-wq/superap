import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  FileDown,
  Gauge,
  History,
  LifeBuoy,
  Scale,
  Sparkles,
  Trash2,
  TrendingDown,
  Wrench,
} from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { useSuperApp } from "@/lib/store";
import {
  alertesTresorerie,
  arbitrerEpargneDette,
  detecterDoublons,
  detecterFuites,
  plansRedressement,
  simulerAchat,
} from "@/lib/simulation";
import {
  type SimulationEnregistree,
  alertesProactives,
  comparerCreditComptant,
  comparerScenarios,
  enregistrerSimulation,
  evaluerFondsUrgence,
  lireHistoriqueSimulations,
  simulerChocRevenu,
  simulerDecouvert,
  simulerInflation,
  strategieRemboursement,
  supprimerSimulation,
  texteSimulation,
} from "@/lib/simulation-plus";
import { exporterRapportPdf } from "@/lib/intelligence-plus";
import { conseiller, evaluerSante, planDAction } from "@/lib/conseil";

export const Route = createFileRoute("/outils")({
  head: () => ({
    meta: [
      { title: "Outils et Simulation — Décidez avant de dépenser" },
      {
        name: "description",
        content:
          "Simulateur « Et si ? », alerte de trésorerie, plans de redressement, arbitrage épargne/dette et détection des fuites, en francs CFA.",
      },
      { property: "og:title", content: "Outils et Simulation — SUPER APP" },
      {
        property: "og:description",
        content:
          "Testez un achat, anticipez une rupture de trésorerie et redressez votre budget en trois scénarios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Outils,
});

function Section({
  titre,
  icone,
  enfants,
  ouvertParDefaut = false,
}: {
  titre: string;
  icone: React.ReactNode;
  enfants: React.ReactNode;
  ouvertParDefaut?: boolean;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  return (
    <section className="carte overflow-hidden">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        <span className="text-primary" aria-hidden>
          {icone}
        </span>
        <h2 className="flex-1 font-semibold">{titre}</h2>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${ouvert ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {ouvert && <div className="space-y-3 border-t border-border p-4">{enfants}</div>}
    </section>
  );
}

const champ = "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm";

function Outils() {
  const {
    transactions,
    enveloppes,
    budgets,
    dettes,
    depensesParEnveloppe,
    soldesParCompte,
    solde,
  } = useSuperApp();

  // Objectif d'épargne
  const [objectif, setObjectif] = useState(500000);
  const [mois, setMois] = useState(12);
  const parMois = mois > 0 ? objectif / mois : 0;

  // Prêt
  const [capital, setCapital] = useState(1000000);
  const [taux, setTaux] = useState(10);
  const [duree, setDuree] = useState(24);
  const i = taux / 100 / 12;
  const mensualite =
    duree > 0 ? (i === 0 ? capital / duree : (capital * i) / (1 - Math.pow(1 + i, -duree))) : 0;
  const coutTotal = mensualite * duree;

  // Et si ?
  const [achat, setAchat] = useState(220000);
  const [etalement, setEtalement] = useState(1);
  const impact = useMemo(
    () => simulerAchat({ montant: achat, solde, transactions, differeMois: etalement }),
    [achat, solde, transactions, etalement],
  );
  const maxTraj = Math.max(1, ...impact.moisTrajectoire.map((m) => Math.abs(m.solde)));

  // Trésorerie
  const alertes = useMemo(
    () => alertesTresorerie({ soldesParCompte, budgets, transactions }),
    [soldesParCompte, budgets, transactions],
  );
  const alertesRouges = alertes.filter((a) => a.enDeficit);

  // Redressement
  const [choc, setChoc] = useState(50000);
  const scenarios = useMemo(
    () => plansRedressement({ choc, transactions, enveloppes, depensesParEnveloppe }),
    [choc, transactions, enveloppes, depensesParEnveloppe],
  );

  // Arbitrage
  const [tauxDette, setTauxDette] = useState(12);
  const [tauxEpargne, setTauxEpargne] = useState(4);
  const [disponible, setDisponible] = useState(100000);
  const arbitrage = useMemo(
    () =>
      arbitrerEpargneDette({
        dettes,
        tauxDette,
        tauxEpargne,
        montantDisponible: disponible,
      }),
    [dettes, tauxDette, tauxEpargne, disponible],
  );

  // Fuites
  const fuites = useMemo(() => detecterFuites(transactions), [transactions]);
  const doublons = useMemo(() => detecterDoublons(transactions), [transactions]);

  /* ---------------- Nouveaux outils ---------------- */

  // 1. Découvert
  const [horizon, setHorizon] = useState(30);
  const decouverts = useMemo(
    () => simulerDecouvert({ soldesParCompte, transactions, horizonJours: horizon }),
    [soldesParCompte, transactions, horizon],
  );

  // 2. Choc de revenu
  const [baisse, setBaisse] = useState(30);
  const chocRevenu = useMemo(
    () => simulerChocRevenu({ transactions, solde, baissePourcent: baisse }),
    [transactions, solde, baisse],
  );

  // 3. Inflation
  const [tauxInflation, setTauxInflation] = useState(5);
  const inflation = useMemo(
    () => simulerInflation({ transactions, tauxAnnuel: tauxInflation }),
    [transactions, tauxInflation],
  );

  // 4. Comparateur de scénarios
  const [optA, setOptA] = useState({ nom: "OPTION A", cout: 300000, dureeMois: 6 });
  const [optB, setOptB] = useState({ nom: "OPTION B", cout: 450000, dureeMois: 12 });
  const comparaison = useMemo(
    () =>
      comparerScenarios({
        options: [optA, optB],
        solde,
        capaciteMensuelle: impact.capaciteMensuelle,
      }),
    [optA, optB, solde, impact.capaciteMensuelle],
  );

  // 5. Stratégie de remboursement
  const [strategie, setStrategie] = useState<"boule-de-neige" | "avalanche">("boule-de-neige");
  const plan = useMemo(
    () =>
      strategieRemboursement({
        dettes,
        capaciteMensuelle: Math.max(1, impact.capaciteMensuelle),
        strategie,
      }),
    [dettes, impact.capaciteMensuelle, strategie],
  );

  // 6. Fonds d'urgence
  const [moisCibles, setMoisCibles] = useState(3);
  const fonds = useMemo(
    () =>
      evaluerFondsUrgence({
        transactions,
        solde,
        moisCibles,
        capaciteMensuelle: impact.capaciteMensuelle,
      }),
    [transactions, solde, moisCibles, impact.capaciteMensuelle],
  );

  // 7. Crédit contre comptant
  const [prixBien, setPrixBien] = useState(600000);
  const [tauxCredit, setTauxCredit] = useState(12);
  const [dureeCredit, setDureeCredit] = useState(12);
  const creditComptant = useMemo(
    () =>
      comparerCreditComptant({
        prix: prixBien,
        tauxAnnuel: tauxCredit,
        dureeMois: dureeCredit,
        solde,
        tauxEpargne,
      }),
    [prixBien, tauxCredit, dureeCredit, solde, tauxEpargne],
  );

  // 8. Alertes proactives
  const proactives = useMemo(
    () =>
      alertesProactives({
        decouverts,
        fondsUrgence: fonds,
        capaciteMensuelle: impact.capaciteMensuelle,
        dettes,
      }),
    [decouverts, fonds, impact.capaciteMensuelle, dettes],
  );

  // 9 & 10. Partage et historique
  const [historique, setHistorique] = useState<SimulationEnregistree[]>([]);
  const [copie, setCopie] = useState(false);
  useEffect(() => {
    setHistorique(lireHistoriqueSimulations());
  }, []);

  const rapportSimulations = () =>
    texteSimulation("Rapport de simulations", [
      "— SIMULATEUR « ET SI ? »",
      `Achat envisagé : ${formatFCFA(achat)} étalé sur ${etalement} mois`,
      impact.message,
      `Capacité d'épargne mensuelle : ${formatFCFA(impact.capaciteMensuelle)}`,
      "",
      "— DÉCOUVERT",
      ...decouverts.map((d) => `• ${d.message}`),
      "",
      "— CHOC DE REVENU",
      `Baisse simulée : ${baisse} %`,
      chocRevenu.message,
      "",
      "— INFLATION",
      inflation.message,
      `Dépenses mensuelles dans 5 ans : ${formatFCFA(inflation.depensesDans5Ans)}`,
      "",
      "— COMPARATEUR DE SCÉNARIOS",
      ...comparaison.map(
        (c) =>
          `• ${c.nom} : ${formatFCFA(c.cout)} sur ${c.dureeMois} mois → solde final ${formatFCFA(
            c.soldeFinal,
          )}${c.meilleur ? " (meilleur)" : ""}`,
      ),
      "",
      "— REMBOURSEMENT DES DETTES",
      plan.message,
      ...plan.etapes.map(
        (e) => `• ${e.personne} : ${formatFCFA(e.reste)} en ${e.moisPourSolder} mois`,
      ),
      "",
      "— FONDS D'URGENCE",
      fonds.message,
      `Couverture actuelle : ${fonds.moisCouverts} mois · cible ${formatFCFA(fonds.cible)}`,
      "",
      "— CRÉDIT CONTRE COMPTANT",
      creditComptant.message,
      `Mensualité : ${formatFCFA(creditComptant.mensualite)} · surcoût ${formatFCFA(creditComptant.surcout)}`,
      "",
      "— ALERTES",
      ...proactives.map((a) => `• [${a.niveau}] ${a.titre} : ${a.detail}`),
    ]);

  const copierRapport = async () => {
    try {
      await navigator.clipboard.writeText(rapportSimulations());
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2500);
    } catch {
      setCopie(false);
    }
  };

  const sauvegarder = () => {
    setHistorique(enregistrerSimulation("Simulation complète", rapportSimulations()));
  };

  /* ---------------- Conseiller intelligent ---------------- */
  const sante = useMemo(
    () => evaluerSante({ transactions, dettes, solde, enveloppes, depensesParEnveloppe }),
    [transactions, dettes, solde, enveloppes, depensesParEnveloppe],
  );
  const recommandations = useMemo(
    () => conseiller({ transactions, enveloppes, budgets, dettes, depensesParEnveloppe, solde }),
    [transactions, enveloppes, budgets, dettes, depensesParEnveloppe, solde],
  );
  const plans = useMemo(() => planDAction(recommandations), [recommandations]);
  const gainTotal = recommandations.reduce((s, r) => s + r.gainMensuel, 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Outils et Simulation</h1>
        <p className="text-sm text-muted-foreground">
          Testez vos décisions avant de les prendre et redressez votre budget.
        </p>
      </header>

      <section className="carte space-y-3 p-4">
        <div className="flex items-center gap-3">
          <span className="text-primary" aria-hidden>
            <Gauge className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="font-semibold">Conseiller intelligent</h2>
            <p className="text-xs text-muted-foreground">
              Santé financière : {sante.score}/100 — {sante.niveau}
            </p>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
            {Math.round(sante.tauxEpargne * 100)} % épargné
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${sante.score}%` }}
          />
        </div>

        <ul className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
          {sante.piliers.map((p) => (
            <li key={p.nom} className="rounded-lg bg-secondary/50 px-2.5 py-1.5">
              <span className="font-medium">{p.nom}</span> — {p.score}/100
              <span className="block text-muted-foreground">{p.commentaire}</span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Revenu moyen {formatFCFA(sante.revenuMensuel)} / mois · Dépenses{" "}
          {formatFCFA(sante.depenseMensuelle)} / mois · Réserve{" "}
          {sante.moisDeReserve.toFixed(1)} mois
        </p>

        {recommandations.length > 0 && (
          <>
            <p className="text-sm font-medium">
              {recommandations.length} conseils prioritaires — potentiel estimé{" "}
              {formatFCFA(gainTotal)} par mois
            </p>
            <ul className="space-y-2">
              {recommandations.map((r) => (
                <li
                  key={r.id}
                  className={`rounded-xl border p-3 text-sm ${
                    r.priorite === "haute"
                      ? "border-destructive/40 bg-destructive/5"
                      : r.priorite === "moyenne"
                        ? "border-amber-500/40 bg-amber-500/5"
                        : "border-border bg-secondary/30"
                  }`}
                >
                  <p className="font-semibold">{r.titre}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.explication}</p>
                  <p className="mt-1 text-xs">👉 {r.action}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Priorité {r.priorite} · {r.horizon}
                    {r.gainMensuel > 0 ? ` · impact ${formatFCFA(r.gainMensuel)} / mois` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="space-y-2">
          {plans
            .filter((p) => p.etapes.length > 0)
            .map((p) => (
              <div key={p.horizon} className="rounded-xl bg-secondary/40 p-3 text-xs">
                <p className="font-semibold">Plan à {p.horizon}</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                  {p.etapes.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ol>
                {p.gainCumule > 0 && (
                  <p className="mt-1 font-medium">
                    Gain cumulé estimé : {formatFCFA(p.gainCumule)} / mois
                  </p>
                )}
              </div>
            ))}
        </div>
      </section>


      {alertesRouges.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Alerte trésorerie
          </p>
          <ul className="mt-1 space-y-1">
            {alertesRouges.map((a) => (
              <li key={a.compte}>
                {a.dateRupture
                  ? `D'ici le ${new Date(a.dateRupture).toLocaleDateString("fr-FR")}, un déficit de ${formatFCFA(
                      Math.abs(a.soldeProjete),
                    )} est prévu sur ${a.compte}.`
                  : `Déficit prévu de ${formatFCFA(Math.abs(a.soldeProjete))} sur ${a.compte} d'ici la fin du mois.`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section
        titre="Simulateur « Et si ? »"
        icone={<Sparkles className="h-5 w-5" />}
        ouvertParDefaut
        enfants={
          <>
            <label className="block text-sm">
              Montant de l'achat envisagé (FCFA)
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={achat}
                onChange={(e) => setAchat(Number(e.target.value))}
                className={champ}
              />
            </label>
            <label className="block text-sm">
              Étalement du paiement (mois)
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={24}
                value={etalement}
                onChange={(e) => setEtalement(Math.max(1, Number(e.target.value)))}
                className={champ}
              />
            </label>
            <div
              className={`rounded-xl p-3 text-sm ${
                impact.verdict === "risquee"
                  ? "bg-destructive/10 text-destructive"
                  : impact.verdict === "tendue"
                    ? "bg-accent text-accent-foreground"
                    : "bg-success/10 text-success"
              }`}
            >
              {impact.message}
            </div>
            <ul className="space-y-1 text-sm">
              <li>
                Capacité d'épargne mensuelle :{" "}
                <strong>{formatFCFA(impact.capaciteMensuelle)}</strong>
              </li>
              <li>
                Solde après paiement : <strong>{formatFCFA(impact.soldeApres)}</strong>
              </li>
              <li>
                Délai pour reconstituer :{" "}
                <strong>
                  {impact.moisPourReconstituer === null
                    ? "impossible au rythme actuel"
                    : `${impact.moisPourReconstituer} mois`}
                </strong>
              </li>
            </ul>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Trajectoire sur 12 mois</p>
              <div className="flex h-24 items-end gap-1">
                {impact.moisTrajectoire.map((m, idx) => (
                  <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t ${m.solde < 0 ? "bg-destructive" : "bg-primary"}`}
                      style={{ height: `${Math.max(3, (Math.abs(m.solde) / maxTraj) * 72)}px` }}
                      title={`${m.label} : ${formatFCFA(m.solde)}`}
                    />
                    <span className="text-[9px] text-muted-foreground">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        }
      />

      <Section
        titre="Prévision de trésorerie par compte"
        icone={<AlertTriangle className="h-5 w-5" />}
        enfants={
          alertes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun compte enregistré.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {alertes.map((a) => (
                <li key={a.compte} className="rounded-xl border border-border p-3">
                  <p className="font-semibold">{a.compte}</p>
                  <p className="text-xs text-muted-foreground">
                    Solde {formatFCFA(a.solde)} · charges à venir {formatFCFA(a.chargesAVenir)} ·
                    dépenses estimées {formatFCFA(a.depensesEstimees)}
                  </p>
                  <p className={a.enDeficit ? "font-semibold text-destructive" : "font-semibold"}>
                    Fin de mois projetée : {formatFCFA(a.soldeProjete)}
                  </p>
                </li>
              ))}
            </ul>
          )
        }
      />

      <Section
        titre="Plan de redressement (3 scénarios)"
        icone={<Wrench className="h-5 w-5" />}
        enfants={
          <>
            <label className="block text-sm">
              Montant de la dépense imprévue (FCFA)
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={choc}
                onChange={(e) => setChoc(Number(e.target.value))}
                className={champ}
              />
            </label>
            <ul className="space-y-2">
              {scenarios.map((s) => (
                <li key={s.id} className="rounded-xl border border-border p-3 text-sm">
                  <p className="font-semibold">{s.titre}</p>
                  <p className="text-xs text-muted-foreground">{s.resume}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                    {s.actions.map((a, k) => (
                      <li key={k}>{a}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    Effort : <strong>{formatFCFA(s.effortMensuel)}</strong> par mois pendant{" "}
                    {s.duree} mois.
                  </p>
                </li>
              ))}
            </ul>
          </>
        }
      />

      <Section
        titre="Arbitrage épargne contre dette"
        icone={<Scale className="h-5 w-5" />}
        enfants={
          <>
            <label className="block text-sm">
              Montant disponible (FCFA)
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={disponible}
                onChange={(e) => setDisponible(Number(e.target.value))}
                className={champ}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Coût de la dette (%/an)
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={tauxDette}
                  onChange={(e) => setTauxDette(Number(e.target.value))}
                  className={champ}
                />
              </label>
              <label className="block text-sm">
                Rendement épargne (%/an)
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={tauxEpargne}
                  onChange={(e) => setTauxEpargne(Number(e.target.value))}
                  className={champ}
                />
              </label>
            </div>
            <div className="rounded-xl bg-accent p-3 text-sm text-accent-foreground">
              {arbitrage.message}
            </div>
            <p className="text-xs text-muted-foreground">
              Intérêts évités : {formatFCFA(arbitrage.coutDette)} · gain d'épargne :{" "}
              {formatFCFA(arbitrage.rendementEpargne)}
            </p>
          </>
        }
      />

      <Section
        titre="Fuites et doublons détectés"
        icone={<AlertTriangle className="h-5 w-5" />}
        enfants={
          <>
            {fuites.length === 0 && doublons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune fuite ni doublon détecté sur les 30 derniers jours.
              </p>
            ) : (
              <>
                {fuites.length > 0 && (
                  <ul className="space-y-2 text-sm">
                    {fuites.slice(0, 6).map((f) => (
                      <li key={f.libelle} className="rounded-xl border border-border p-3">
                        <p className="font-semibold">{f.libelle}</p>
                        <p className="text-xs text-muted-foreground">{f.conseil}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {doublons.length > 0 && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
                    <p className="font-semibold text-destructive">Doublons de saisie possibles</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      {doublons.slice(0, 5).map((d, k) => (
                        <li key={k}>
                          {d.libelle} — {formatFCFA(d.montant)} saisi {d.nombre} fois le{" "}
                          {new Date(d.date).toLocaleDateString("fr-FR")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        }
      />

      <Section
        titre="Objectif d'épargne"
        icone={<Sparkles className="h-5 w-5" />}
        enfants={
          <>
            <label className="block text-sm">
              Montant visé (FCFA)
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={objectif}
                onChange={(e) => setObjectif(Number(e.target.value))}
                className={champ}
              />
            </label>
            <label className="block text-sm">
              Durée (mois)
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={mois}
                onChange={(e) => setMois(Number(e.target.value))}
                className={champ}
              />
            </label>
            <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
              À mettre de côté : <strong>{formatFCFA(parMois)}</strong> par mois.
            </p>
          </>
        }
      />

      <Section
        titre="Simulation de prêt"
        icone={<Scale className="h-5 w-5" />}
        enfants={
          <>
            <label className="block text-sm">
              Capital emprunté (FCFA)
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={capital}
                onChange={(e) => setCapital(Number(e.target.value))}
                className={champ}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Taux annuel (%)
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.1}
                  value={taux}
                  onChange={(e) => setTaux(Number(e.target.value))}
                  className={champ}
                />
              </label>
              <label className="block text-sm">
                Durée (mois)
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={duree}
                  onChange={(e) => setDuree(Number(e.target.value))}
                  className={champ}
                />
              </label>
            </div>
            <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
              Mensualité : <strong>{formatFCFA(mensualite)}</strong>
              <br />
              Coût total : <strong>{formatFCFA(coutTotal)}</strong> (intérêts{" "}
              {formatFCFA(Math.max(coutTotal - capital, 0))})
            </p>
          </>
        }
      />

      <Section
        titre="Simulateur de découvert"
        icone={<TrendingDown className="h-5 w-5" />}
        enfants={
          <>
            <label className="block text-sm">
              Horizon d'analyse (jours)
              <input
                type="number"
                inputMode="numeric"
                min={7}
                max={180}
                value={horizon}
                onChange={(e) => setHorizon(Math.max(7, Number(e.target.value)))}
                className={champ}
              />
            </label>
            {decouverts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun compte enregistré.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {decouverts.map((d) => (
                  <li
                    key={d.compte}
                    className={`rounded-xl border p-3 ${
                      d.dateDecouvert ? "border-destructive/40 bg-destructive/10" : "border-border"
                    }`}
                  >
                    <p className="font-semibold">{d.compte}</p>
                    <p className="text-xs text-muted-foreground">
                      Sortie estimée {formatFCFA(d.sortieParJour)} par jour ·{" "}
                      {d.joursTenus === null
                        ? "aucune sortie détectée"
                        : `${d.joursTenus} jours tenus`}
                    </p>
                    <p className="mt-1">{d.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        }
      />

      <Section
        titre="Simulateur de perte de revenu"
        icone={<TrendingDown className="h-5 w-5" />}
        enfants={
          <>
            <label className="block text-sm">
              Baisse de revenu simulée (%)
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={baisse}
                onChange={(e) => setBaisse(Number(e.target.value))}
                className={champ}
              />
            </label>
            <div
              className={`rounded-xl p-3 text-sm ${
                chocRevenu.margeApres < 0
                  ? "bg-destructive/10 text-destructive"
                  : "bg-success/10 text-success"
              }`}
            >
              {chocRevenu.message}
            </div>
            <ul className="space-y-1 text-sm">
              <li>
                Revenu actuel : <strong>{formatFCFA(chocRevenu.revenuActuel)}</strong>
              </li>
              <li>
                Revenu après baisse : <strong>{formatFCFA(chocRevenu.revenuApres)}</strong>
              </li>
              <li>
                Dépenses mensuelles : <strong>{formatFCFA(chocRevenu.depensesMensuelles)}</strong>
              </li>
              <li>
                Marge restante : <strong>{formatFCFA(chocRevenu.margeApres)}</strong>
              </li>
            </ul>
          </>
        }
      />

      <Section
        titre="Simulateur d'inflation"
        icone={<TrendingDown className="h-5 w-5" />}
        enfants={
          <>
            <label className="block text-sm">
              Hausse annuelle des prix (%)
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={tauxInflation}
                onChange={(e) => setTauxInflation(Number(e.target.value))}
                className={champ}
              />
            </label>
            <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
              {inflation.message}
            </p>
            <ul className="space-y-1 text-sm">
              <li>
                Aujourd'hui : <strong>{formatFCFA(inflation.depensesActuelles)}</strong> par mois
              </li>
              <li>
                Dans 1 an : <strong>{formatFCFA(inflation.depensesDans1An)}</strong> par mois
              </li>
              <li>
                Dans 5 ans : <strong>{formatFCFA(inflation.depensesDans5Ans)}</strong> par mois
              </li>
            </ul>
          </>
        }
      />

      <Section
        titre="Comparateur de scénarios"
        icone={<Scale className="h-5 w-5" />}
        enfants={
          <>
            {[
              { val: optA, set: setOptA, titre: "Scénario A" },
              { val: optB, set: setOptB, titre: "Scénario B" },
            ].map((bloc) => (
              <div key={bloc.titre} className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground">{bloc.titre}</p>
                <label className="block text-sm">
                  Nom
                  <input
                    type="text"
                    value={bloc.val.nom}
                    onChange={(e) => bloc.set({ ...bloc.val, nom: e.target.value })}
                    className={champ}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    Coût (FCFA)
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={bloc.val.cout}
                      onChange={(e) => bloc.set({ ...bloc.val, cout: Number(e.target.value) })}
                      className={champ}
                    />
                  </label>
                  <label className="block text-sm">
                    Durée (mois)
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={bloc.val.dureeMois}
                      onChange={(e) =>
                        bloc.set({ ...bloc.val, dureeMois: Math.max(1, Number(e.target.value)) })
                      }
                      className={champ}
                    />
                  </label>
                </div>
              </div>
            ))}
            <ul className="space-y-2 text-sm">
              {comparaison.map((c) => (
                <li
                  key={c.nom}
                  className={`rounded-xl border p-3 ${
                    c.meilleur ? "border-success/50 bg-success/10" : "border-border"
                  }`}
                >
                  <p className="font-semibold">
                    {c.nom} {c.meilleur && "· meilleur choix"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFCFA(c.coutMensuel)} par mois pendant {c.dureeMois} mois
                  </p>
                  <p>
                    Solde final projeté : <strong>{formatFCFA(c.soldeFinal)}</strong>
                    {!c.meilleur && ` (${formatFCFA(c.ecartMeilleur)} face au meilleur)`}
                  </p>
                </li>
              ))}
            </ul>
          </>
        }
      />

      <Section
        titre="Stratégie de remboursement des dettes"
        icone={<Wrench className="h-5 w-5" />}
        enfants={
          <>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "boule-de-neige", label: "Boule de neige" },
                  { id: "avalanche", label: "Avalanche" },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStrategie(s.id)}
                  className={`rounded-xl border p-2 text-xs font-semibold ${
                    strategie === s.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
              {plan.message}
            </p>
            {plan.etapes.length > 0 && (
              <ol className="space-y-2 text-sm">
                {plan.etapes.map((e, k) => (
                  <li key={e.personne + k} className="rounded-xl border border-border p-3">
                    <p className="font-semibold">
                      {k + 1}. {e.personne}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reste {formatFCFA(e.reste)} · soldé en {e.moisPourSolder} mois (cumul{" "}
                      {e.cumulMois} mois)
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </>
        }
      />

      <Section
        titre="Fonds d'urgence"
        icone={<LifeBuoy className="h-5 w-5" />}
        enfants={
          <>
            <label className="block text-sm">
              Mois de dépenses à couvrir
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={24}
                value={moisCibles}
                onChange={(e) => setMoisCibles(Math.max(1, Number(e.target.value)))}
                className={champ}
              />
            </label>
            <div
              className={`rounded-xl p-3 text-sm ${
                fonds.niveau === "solide"
                  ? "bg-success/10 text-success"
                  : fonds.niveau === "correct"
                    ? "bg-accent text-accent-foreground"
                    : "bg-destructive/10 text-destructive"
              }`}
            >
              {fonds.message}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${Math.min(100, Math.round((fonds.moisCouverts / Math.max(1, moisCibles)) * 100))}%`,
                }}
              />
            </div>
            <ul className="space-y-1 text-sm">
              <li>
                Couverture actuelle : <strong>{fonds.moisCouverts} mois</strong>
              </li>
              <li>
                Cible : <strong>{formatFCFA(fonds.cible)}</strong>
              </li>
              <li>
                Manquant : <strong>{formatFCFA(fonds.manquant)}</strong>
              </li>
            </ul>
          </>
        }
      />

      <Section
        titre="Crédit contre paiement comptant"
        icone={<CreditCard className="h-5 w-5" />}
        enfants={
          <>
            <label className="block text-sm">
              Prix du bien (FCFA)
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={prixBien}
                onChange={(e) => setPrixBien(Number(e.target.value))}
                className={champ}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Taux du crédit (%/an)
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={tauxCredit}
                  onChange={(e) => setTauxCredit(Number(e.target.value))}
                  className={champ}
                />
              </label>
              <label className="block text-sm">
                Durée (mois)
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={dureeCredit}
                  onChange={(e) => setDureeCredit(Math.max(1, Number(e.target.value)))}
                  className={champ}
                />
              </label>
            </div>
            <div className="rounded-xl bg-accent p-3 text-sm text-accent-foreground">
              {creditComptant.message}
            </div>
            <ul className="space-y-1 text-sm">
              <li>
                Mensualité : <strong>{formatFCFA(creditComptant.mensualite)}</strong>
              </li>
              <li>
                Coût total du crédit : <strong>{formatFCFA(creditComptant.coutCredit)}</strong>
              </li>
              <li>
                Surcoût des intérêts : <strong>{formatFCFA(creditComptant.surcout)}</strong>
              </li>
              <li>
                Solde après achat comptant :{" "}
                <strong>{formatFCFA(creditComptant.soldeApresComptant)}</strong>
              </li>
            </ul>
          </>
        }
      />

      <Section
        titre="Alertes proactives"
        icone={<Bell className="h-5 w-5" />}
        ouvertParDefaut
        enfants={
          <ul className="space-y-2 text-sm">
            {proactives.map((a) => (
              <li
                key={a.id}
                className={`rounded-xl border p-3 ${
                  a.niveau === "critique"
                    ? "border-destructive/40 bg-destructive/10"
                    : a.niveau === "attention"
                      ? "border-border bg-accent"
                      : "border-border"
                }`}
              >
                <p className="font-semibold">{a.titre}</p>
                <p className="text-xs text-muted-foreground">{a.detail}</p>
              </li>
            ))}
          </ul>
        }
      />

      <Section
        titre="Historique des simulations"
        icone={<History className="h-5 w-5" />}
        enfants={
          historique.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune simulation enregistrée pour le moment.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {historique.map((s) => (
                <li key={s.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.titre}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.date).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => exporterRapportPdf(s.titre, s.contenu)}
                      aria-label="Exporter cette simulation en PDF"
                      title="Exporter en PDF"
                      className="rounded-lg border border-border p-2"
                    >
                      <FileDown className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistorique(supprimerSimulation(s.id))}
                      aria-label="Supprimer cette simulation"
                      title="Supprimer"
                      className="rounded-lg border border-destructive/40 p-2 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      />

      <div className="space-y-2">
        <button
          type="button"
          onClick={copierRapport}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-semibold"
        >
          {copie ? (
            <Check className="h-4 w-4 text-success" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copie ? "Simulation copiée" : "Copier la simulation"}
        </button>
        <button
          type="button"
          onClick={() => exporterRapportPdf("Rapport de simulations", rapportSimulations())}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground"
        >
          <FileDown className="h-4 w-4" aria-hidden />
          Exporter la simulation en PDF
        </button>
        <button
          type="button"
          onClick={sauvegarder}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-semibold"
        >
          <History className="h-4 w-4" aria-hidden />
          Enregistrer dans l'historique
        </button>
      </div>
    </div>
  );
}
