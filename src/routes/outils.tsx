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
  const { transactions, enveloppes, budgets, dettes, depensesParEnveloppe, soldesParCompte, solde } =
    useSuperApp();

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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Outils et Simulation</h1>
        <p className="text-sm text-muted-foreground">
          Testez vos décisions avant de les prendre et redressez votre budget.
        </p>
      </header>

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
    </div>
  );
}
