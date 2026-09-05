import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, grouperMontant } from "@/lib/format";
import { simulerAchat } from "@/lib/simulation";
import { previsionFinDeMois } from "@/lib/ia-avancee";

export const Route = createFileRoute("/simulation")({
  head: () => ({
    meta: [
      { title: "Simulation « si je dépense » — SUPER APP" },
      {
        name: "description",
        content:
          "Avant une grosse dépense, voyez immédiatement son effet sur votre solde, vos enveloppes et vos prochains mois, en francs CFA.",
      },
      { property: "og:title", content: "Simulation d'une dépense — SUPER APP" },
      {
        property: "og:description",
        content: "L'effet d'une dépense sur votre solde, vos enveloppes et vos prochains mois.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageSimulation,
});

const VERDICTS = {
  sereine: { texte: "Dépense sereine", classe: "border-success/40 bg-success/10 text-success" },
  tendue: { texte: "Dépense tendue", classe: "border-amber-400/50 bg-amber-400/10 text-amber-600" },
  risquee: {
    texte: "Dépense risquée",
    classe: "border-destructive/40 bg-destructive/10 text-destructive",
  },
} as const;

function PageSimulation() {
  const { transactions, enveloppes, depensesParEnveloppe, soldeDisponible } = useSuperApp();
  const [montant, setMontant] = useState("");
  const [mois, setMois] = useState(1);
  const [enveloppe, setEnveloppe] = useState<string>("");

  const valeur = Number(montant.replace(/\s/g, "")) || 0;

  const impact = useMemo(
    () =>
      valeur > 0
        ? simulerAchat({
            montant: valeur,
            solde: soldeDisponible,
            transactions,
            differeMois: mois,
          })
        : null,
    [valeur, soldeDisponible, transactions, mois],
  );

  const effetEnveloppe = useMemo(() => {
    if (!enveloppe || valeur <= 0) return null;
    const base = previsionFinDeMois({
      enveloppes,
      depensesParEnveloppe: {
        ...depensesParEnveloppe,
        [enveloppe]: (depensesParEnveloppe[enveloppe] ?? 0) + valeur,
      },
    });
    return base.find((p) => p.id === enveloppe) ?? null;
  }, [enveloppe, valeur, enveloppes, depensesParEnveloppe]);

  return (
    <div className="space-y-4">
      <section className="carte space-y-3 p-4">
        <label className="block text-sm font-medium" htmlFor="montant-simulation">
          Montant de la dépense envisagée
        </label>
        <input
          id="montant-simulation"
          inputMode="numeric"
          value={montant}
          onChange={(e) => setMontant(grouperMontant(e.target.value))}
          placeholder="0"
          className="w-full rounded-xl border bg-background p-3 text-2xl font-semibold"
        />

        <label className="block text-sm font-medium" htmlFor="etalement-simulation">
          Étaler le paiement sur
        </label>
        <select
          id="etalement-simulation"
          value={mois}
          onChange={(e) => setMois(Number(e.target.value))}
          className="w-full rounded-xl border bg-background p-3 text-sm"
        >
          {[1, 2, 3, 6, 12].map((m) => (
            <option key={m} value={m}>
              {m === 1 ? "Une seule fois" : `${m} mois`}
            </option>
          ))}
        </select>

        <label className="block text-sm font-medium" htmlFor="enveloppe-simulation">
          Enveloppe concernée (facultatif)
        </label>
        <select
          id="enveloppe-simulation"
          value={enveloppe}
          onChange={(e) => setEnveloppe(e.target.value)}
          className="w-full rounded-xl border bg-background p-3 text-sm"
        >
          <option value="">Aucune enveloppe</option>
          {enveloppes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nom}
            </option>
          ))}
        </select>
      </section>

      {impact && (
        <section className={`carte space-y-2 border p-4 ${VERDICTS[impact.verdict].classe}`}>
          <p className="text-sm font-semibold">{VERDICTS[impact.verdict].texte}</p>
          <p className="text-xs text-foreground/80">{impact.message}</p>
          <ul className="space-y-1 text-xs text-foreground/80">
            <li>Solde juste après : {formatFCFA(impact.soldeApres)}</li>
            <li>
              Ce que vous pouvez mettre de côté chaque mois : {formatFCFA(impact.capaciteMensuelle)}
            </li>
            <li>
              Temps pour reconstituer :{" "}
              {impact.moisPourReconstituer
                ? `${impact.moisPourReconstituer} mois`
                : "non estimable"}
            </li>
          </ul>
        </section>
      )}

      {impact && (
        <section className="carte space-y-2 p-4">
          <h2 className="text-sm font-semibold">Les 12 prochains mois</h2>
          <ul className="grid grid-cols-2 gap-2 text-xs">
            {impact.moisTrajectoire.map((m, i) => (
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
      )}

      {effetEnveloppe && (
        <section className="carte space-y-1 p-4">
          <h2 className="text-sm font-semibold">Effet sur « {effetEnveloppe.nom} »</h2>
          <p className="text-xs text-muted-foreground">{effetEnveloppe.phrase}</p>
          <p className="text-xs text-muted-foreground">
            Projection du mois : {formatFCFA(effetEnveloppe.projete)} pour une enveloppe de{" "}
            {formatFCFA(effetEnveloppe.dotation)}
          </p>
        </section>
      )}

      {!impact && (
        <p className="px-1 text-xs text-muted-foreground">
          Saisissez un montant pour voir tout de suite l'effet sur votre argent.
        </p>
      )}
    </div>
  );
}
