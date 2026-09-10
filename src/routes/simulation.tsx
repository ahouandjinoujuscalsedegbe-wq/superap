import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, grouperMontant } from "@/lib/format";
import {
  simulerDepense,
  simulerObjectif,
  simulerTontine,
  simulerRevenu,
  simulerDette,
  simulerEconomie,
  suggestionsSimulation,
  type ContexteSimulation,
  type ResultatSimulation,
  type TypeSimulation,
} from "@/lib/simulations";

export const Route = createFileRoute("/simulation")({
  head: () => ({
    meta: [
      { title: "Simulation avant décision — SUPER APP" },
      {
        name: "description",
        content:
          "Simulez une dépense, un objectif, une tontine, un emprunt ou une économie et voyez l'effet sur votre argent en francs CFA.",
      },
      { property: "og:title", content: "Simulation avant décision — SUPER APP" },
      {
        property: "og:description",
        content:
          "Dépense, objectif, tontine, revenu, dette ou économie : l'effet sur votre solde et vos douze prochains mois.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageSimulation,
});

const ONGLETS: { id: TypeSimulation; nom: string }[] = [
  { id: "objectif", nom: "Objectif" },
  { id: "depense", nom: "Dépense" },
  { id: "tontine", nom: "Tontine" },
  { id: "dette", nom: "Dette" },
  { id: "revenu", nom: "Revenu" },
  { id: "economie", nom: "Économie" },
];

const VERDICTS = {
  favorable: "border-success/40 bg-success/10 text-success",
  tendu: "border-amber-400/50 bg-amber-400/10 text-amber-600",
  risque: "border-destructive/40 bg-destructive/10 text-destructive",
} as const;

const CHAMP = "w-full rounded-xl border bg-background p-3 text-sm";

function nombre(valeur: string): number {
  return Number(String(valeur).replace(/\s/g, "")) || 0;
}

function dansUnAn(): string {
  const d = new Date();
  return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()).toISOString().slice(0, 10);
}

function PageSimulation() {
  const {
    transactions,
    transferts,
    enveloppes,
    budgets,
    dettes,
    objectifs,
    depensesParEnveloppe,
    soldeDisponible,
  } = useSuperApp();

  const [onglet, setOnglet] = useState<TypeSimulation>("objectif");

  // Dépense
  const [montantDepense, setMontantDepense] = useState("");
  const [etalement, setEtalement] = useState(1);
  const [enveloppe, setEnveloppe] = useState("");
  // Objectif
  const [cible, setCible] = useState("");
  const [deja, setDeja] = useState("");
  const [dateCible, setDateCible] = useState(dansUnAn());
  // Tontine
  const [montantTour, setMontantTour] = useState("");
  const [participants, setParticipants] = useState("10");
  const [rang, setRang] = useState("1");
  const [frequence, setFrequence] = useState<"jour" | "semaine" | "quinzaine" | "mois">("mois");
  // Dette
  const [montantDette, setMontantDette] = useState("");
  const [mensualite, setMensualite] = useState("");
  const [sensDette, setSensDette] = useState<"emprunter" | "rembourser">("rembourser");
  // Revenu / économie
  const [variation, setVariation] = useState("");
  const [sensRevenu, setSensRevenu] = useState<"hausse" | "baisse">("hausse");
  const [economie, setEconomie] = useState("");

  const ctx: ContexteSimulation = useMemo(
    () => ({
      transactions,
      transferts,
      enveloppes,
      budgets,
      dettes,
      objectifs,
      depensesParEnveloppe,
      soldeDisponible,
    }),
    [
      transactions,
      transferts,
      enveloppes,
      budgets,
      dettes,
      objectifs,
      depensesParEnveloppe,
      soldeDisponible,
    ],
  );

  const suggestions = useMemo(() => suggestionsSimulation(ctx), [ctx]);

  const resultat: ResultatSimulation | null = useMemo(() => {
    switch (onglet) {
      case "depense": {
        const m = nombre(montantDepense);
        return m > 0
          ? simulerDepense(ctx, {
              montant: m,
              etalementMois: etalement,
              ...(enveloppe ? { enveloppeId: enveloppe } : {}),
            })
          : null;
      }
      case "objectif": {
        const c = nombre(cible);
        return c > 0 ? simulerObjectif(ctx, { cible: c, deja: nombre(deja), dateCible }) : null;
      }
      case "tontine": {
        const t = nombre(montantTour);
        return t > 0
          ? simulerTontine(ctx, {
              montantTour: t,
              participants: nombre(participants),
              rang: nombre(rang),
              frequence,
            })
          : null;
      }
      case "dette": {
        const m = nombre(montantDette);
        const men = nombre(mensualite);
        return m > 0 && men > 0
          ? simulerDette(ctx, { montant: m, mensualite: men, sens: sensDette })
          : null;
      }
      case "revenu": {
        const v = nombre(variation);
        return v > 0
          ? simulerRevenu(ctx, { variationMensuelle: sensRevenu === "hausse" ? v : -v })
          : null;
      }
      case "economie": {
        const e = nombre(economie);
        return e > 0 ? simulerEconomie(ctx, { economieMensuelle: e }) : null;
      }
    }
  }, [
    onglet,
    ctx,
    montantDepense,
    etalement,
    enveloppe,
    cible,
    deja,
    dateCible,
    montantTour,
    participants,
    rang,
    frequence,
    montantDette,
    mensualite,
    sensDette,
    variation,
    sensRevenu,
    economie,
  ]);

  function appliquerSuggestion(v: Record<string, string | number>, type: TypeSimulation) {
    setOnglet(type);
    if (v["montant"] !== undefined) {
      setMontantDepense(grouperMontant(String(v["montant"])));
      setMontantDette(grouperMontant(String(v["montant"])));
    }
    if (v["etalementMois"] !== undefined) setEtalement(Number(v["etalementMois"]));
    if (v["enveloppeId"] !== undefined) setEnveloppe(String(v["enveloppeId"]));
    if (v["cible"] !== undefined) setCible(grouperMontant(String(v["cible"])));
    if (v["deja"] !== undefined) setDeja(grouperMontant(String(v["deja"])));
    if (v["dateCible"] !== undefined) setDateCible(String(v["dateCible"]));
    if (v["montantTour"] !== undefined) setMontantTour(grouperMontant(String(v["montantTour"])));
    if (v["participants"] !== undefined) setParticipants(String(v["participants"]));
    if (v["rang"] !== undefined) setRang(String(v["rang"]));
    if (v["frequence"] !== undefined)
      setFrequence(String(v["frequence"]) as "jour" | "semaine" | "quinzaine" | "mois");
    if (v["mensualite"] !== undefined) setMensualite(grouperMontant(String(v["mensualite"])));
    if (v["sens"] !== undefined) setSensDette(String(v["sens"]) as "emprunter" | "rembourser");
    if (v["variationMensuelle"] !== undefined)
      setVariation(grouperMontant(String(v["variationMensuelle"])));
    if (v["economieMensuelle"] !== undefined)
      setEconomie(grouperMontant(String(v["economieMensuelle"])));
  }

  return (
    <div className="space-y-4">
      {suggestions.length > 0 && (
        <section className="carte space-y-2 p-4">
          <h2 className="text-sm font-semibold">À simuler en priorité</h2>
          <p className="text-xs text-muted-foreground">
            Proposé à partir de vos opérations, enveloppes, objectifs et dettes.
          </p>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => appliquerSuggestion(s.valeurs, s.type)}
                  className="w-full rounded-xl border border-border bg-muted/30 p-3 text-left active:scale-[0.99]"
                >
                  <span className="block text-sm font-semibold">{s.titre}</span>
                  <span className="block text-xs text-muted-foreground">{s.raison}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Type de simulation">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOnglet(o.id)}
            aria-current={onglet === o.id ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              onglet === o.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground"
            }`}
          >
            {o.nom}
          </button>
        ))}
      </nav>

      <section className="carte space-y-3 p-4">
        {onglet === "objectif" && (
          <>
            <label className="block text-sm font-medium" htmlFor="cible">
              Montant visé
            </label>
            <input
              id="cible"
              inputMode="numeric"
              value={cible}
              onChange={(e) => setCible(grouperMontant(e.target.value))}
              placeholder="0"
              className="w-full rounded-xl border bg-background p-3 text-2xl font-semibold"
            />
            <label className="block text-sm font-medium" htmlFor="deja">
              Déjà mis de côté
            </label>
            <input
              id="deja"
              inputMode="numeric"
              value={deja}
              onChange={(e) => setDeja(grouperMontant(e.target.value))}
              placeholder="0"
              className={CHAMP}
            />
            <label className="block text-sm font-medium" htmlFor="date-cible">
              Date visée
            </label>
            <input
              id="date-cible"
              type="date"
              value={dateCible}
              onChange={(e) => setDateCible(e.target.value)}
              className={CHAMP}
            />
          </>
        )}

        {onglet === "depense" && (
          <>
            <label className="block text-sm font-medium" htmlFor="montant-depense">
              Montant de la dépense envisagée
            </label>
            <input
              id="montant-depense"
              inputMode="numeric"
              value={montantDepense}
              onChange={(e) => setMontantDepense(grouperMontant(e.target.value))}
              placeholder="0"
              className="w-full rounded-xl border bg-background p-3 text-2xl font-semibold"
            />
            <label className="block text-sm font-medium" htmlFor="etalement">
              Étaler le paiement sur
            </label>
            <select
              id="etalement"
              value={etalement}
              onChange={(e) => setEtalement(Number(e.target.value))}
              className={CHAMP}
            >
              {[1, 2, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m === 1 ? "Une seule fois" : `${m} mois`}
                </option>
              ))}
            </select>
            <label className="block text-sm font-medium" htmlFor="enveloppe">
              Enveloppe concernée (facultatif)
            </label>
            <select
              id="enveloppe"
              value={enveloppe}
              onChange={(e) => setEnveloppe(e.target.value)}
              className={CHAMP}
            >
              <option value="">Aucune enveloppe</option>
              {enveloppes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </>
        )}

        {onglet === "tontine" && (
          <>
            <label className="block text-sm font-medium" htmlFor="montant-tour">
              Montant d'une cotisation
            </label>
            <input
              id="montant-tour"
              inputMode="numeric"
              value={montantTour}
              onChange={(e) => setMontantTour(grouperMontant(e.target.value))}
              placeholder="0"
              className="w-full rounded-xl border bg-background p-3 text-2xl font-semibold"
            />
            <label className="block text-sm font-medium" htmlFor="frequence">
              Rythme des cotisations
            </label>
            <select
              id="frequence"
              value={frequence}
              onChange={(e) =>
                setFrequence(e.target.value as "jour" | "semaine" | "quinzaine" | "mois")
              }
              className={CHAMP}
            >
              <option value="jour">Chaque jour</option>
              <option value="semaine">Chaque semaine</option>
              <option value="quinzaine">Toutes les deux semaines</option>
              <option value="mois">Chaque mois</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium" htmlFor="participants">
                  Participants
                </label>
                <input
                  id="participants"
                  inputMode="numeric"
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value.replace(/\D/g, ""))}
                  className={CHAMP}
                />
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="rang">
                  Votre rang
                </label>
                <input
                  id="rang"
                  inputMode="numeric"
                  value={rang}
                  onChange={(e) => setRang(e.target.value.replace(/\D/g, ""))}
                  className={CHAMP}
                />
              </div>
            </div>
          </>
        )}

        {onglet === "dette" && (
          <>
            <label className="block text-sm font-medium" htmlFor="sens-dette">
              Situation
            </label>
            <select
              id="sens-dette"
              value={sensDette}
              onChange={(e) => setSensDette(e.target.value as "emprunter" | "rembourser")}
              className={CHAMP}
            >
              <option value="rembourser">Rembourser une dette</option>
              <option value="emprunter">Emprunter une somme</option>
            </select>
            <label className="block text-sm font-medium" htmlFor="montant-dette">
              Montant concerné
            </label>
            <input
              id="montant-dette"
              inputMode="numeric"
              value={montantDette}
              onChange={(e) => setMontantDette(grouperMontant(e.target.value))}
              placeholder="0"
              className="w-full rounded-xl border bg-background p-3 text-2xl font-semibold"
            />
            <label className="block text-sm font-medium" htmlFor="mensualite">
              Ce que vous pouvez payer chaque mois
            </label>
            <input
              id="mensualite"
              inputMode="numeric"
              value={mensualite}
              onChange={(e) => setMensualite(grouperMontant(e.target.value))}
              placeholder="0"
              className={CHAMP}
            />
          </>
        )}

        {onglet === "revenu" && (
          <>
            <label className="block text-sm font-medium" htmlFor="sens-revenu">
              Changement
            </label>
            <select
              id="sens-revenu"
              value={sensRevenu}
              onChange={(e) => setSensRevenu(e.target.value as "hausse" | "baisse")}
              className={CHAMP}
            >
              <option value="hausse">Revenu en plus</option>
              <option value="baisse">Revenu en moins</option>
            </select>
            <label className="block text-sm font-medium" htmlFor="variation">
              Montant par mois
            </label>
            <input
              id="variation"
              inputMode="numeric"
              value={variation}
              onChange={(e) => setVariation(grouperMontant(e.target.value))}
              placeholder="0"
              className="w-full rounded-xl border bg-background p-3 text-2xl font-semibold"
            />
          </>
        )}

        {onglet === "economie" && (
          <>
            <label className="block text-sm font-medium" htmlFor="economie">
              Économie envisagée chaque mois
            </label>
            <input
              id="economie"
              inputMode="numeric"
              value={economie}
              onChange={(e) => setEconomie(grouperMontant(e.target.value))}
              placeholder="0"
              className="w-full rounded-xl border bg-background p-3 text-2xl font-semibold"
            />
          </>
        )}
      </section>

      {resultat ? (
        <>
          <section className={`carte space-y-2 border p-4 ${VERDICTS[resultat.verdict]}`}>
            <p className="text-sm font-semibold">{resultat.titre}</p>
            <p className="text-xs text-foreground/80">{resultat.message}</p>
            <ul className="space-y-1 text-xs text-foreground/80">
              {resultat.lignes.map((l) => (
                <li key={l.libelle} className="flex justify-between gap-2">
                  <span>{l.libelle}</span>
                  <span className="font-semibold">{l.valeur}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="carte space-y-2 p-4">
            <h2 className="text-sm font-semibold">Les 12 prochains mois</h2>
            <ul className="grid grid-cols-2 gap-2 text-xs">
              {resultat.trajectoire.map((m, i) => (
                <li
                  key={`${m.label}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-muted/40 p-2"
                >
                  <span className="capitalize">{m.label}</span>
                  <span className={m.solde < 0 ? "text-destructive" : "text-success"}>
                    {formatFCFA(m.solde)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {resultat.conseils.length > 0 && (
            <section className="carte space-y-1 p-4">
              <h2 className="text-sm font-semibold">Ce qu'il faut retenir</h2>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {resultat.conseils.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">
          Renseignez les montants ci-dessus pour voir tout de suite l'effet sur votre argent.
        </p>
      )}
    </div>
  );
}
