import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/outils")({
  head: () => ({
    meta: [
      { title: "Outils et Simulation — Épargne et prêt en FCFA" },
      {
        name: "description",
        content:
          "Simulez un objectif d'épargne et la mensualité d'un prêt en francs CFA, directement sur votre téléphone.",
      },
      { property: "og:title", content: "Outils et Simulation — SUPER APP" },
      {
        property: "og:description",
        content: "Simulateur d'épargne et calculateur de mensualité de prêt en FCFA.",
      },
    ],
  }),
  component: Outils,
});

function Outils() {
  const [objectif, setObjectif] = useState(500000);
  const [mois, setMois] = useState(12);

  const [capital, setCapital] = useState(1000000);
  const [taux, setTaux] = useState(10);
  const [duree, setDuree] = useState(24);

  const parMois = mois > 0 ? objectif / mois : 0;

  const i = taux / 100 / 12;
  const mensualite =
    duree > 0 ? (i === 0 ? capital / duree : (capital * i) / (1 - Math.pow(1 + i, -duree))) : 0;
  const coutTotal = mensualite * duree;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Outils et Simulation</h1>
        <p className="text-sm text-muted-foreground">Préparez vos décisions financières.</p>
      </header>

      <section className="carte space-y-3 p-4">
        <h2 className="font-semibold">Objectif d'épargne</h2>
        <label className="block text-sm">
          Montant visé (FCFA)
          <input
            type="number"
            min={0}
            value={objectif}
            onChange={(e) => setObjectif(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Durée (mois)
          <input
            type="number"
            min={1}
            value={mois}
            onChange={(e) => setMois(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
          À mettre de côté : <strong>{formatFCFA(parMois)}</strong> par mois.
        </p>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="font-semibold">Simulation de prêt</h2>
        <label className="block text-sm">
          Capital emprunté (FCFA)
          <input
            type="number"
            min={0}
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Taux annuel (%)
            <input
              type="number"
              min={0}
              step={0.1}
              value={taux}
              onChange={(e) => setTaux(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Durée (mois)
            <input
              type="number"
              min={1}
              value={duree}
              onChange={(e) => setDuree(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2"
            />
          </label>
        </div>
        <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
          Mensualité : <strong>{formatFCFA(mensualite)}</strong>
          <br />
          Coût total : <strong>{formatFCFA(coutTotal)}</strong> (intérêts{" "}
          {formatFCFA(Math.max(coutTotal - capital, 0))})
        </p>
      </section>
    </div>
  );
}
