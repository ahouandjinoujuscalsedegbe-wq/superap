import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { COMPTES, useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/revenu")({
  head: () => ({
    meta: [
      { title: "Ajouter un revenu — Salaires et entrées en FCFA" },
      {
        name: "description",
        content:
          "Enregistrez en quelques secondes un salaire, une activité ou une aide reçue par le foyer, en francs CFA.",
      },
      { property: "og:title", content: "Ajouter un revenu — SUPER APP" },
      {
        property: "og:description",
        content: "Enregistrez les entrées d'argent du foyer en francs CFA.",
      },
    ],
  }),
  component: AjouterRevenu,
});

const MONTANTS_RAPIDES = [5000, 10000, 25000, 50000, 100000];

function AjouterRevenu() {
  const { ajouterTransaction, sourcesRevenu, comptes } = useSuperApp();
  const navigate = useNavigate();
  const [montant, setMontant] = useState("");
  const [libelle, setLibelle] = useState("");
  const [source, setSource] = useState<string>(sourcesRevenu[0] ?? "Autre");
  const [compte, setCompte] = useState<string>(comptes[0] ?? COMPTES[0]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const valeur = Number(montant.replace(/\s/g, "")) || 0;

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (valeur <= 0) {
      toast.error("Veuillez saisir un montant valide.");
      return;
    }
    ajouterTransaction({
      type: "revenu",
      montant: valeur,
      libelle: libelle.trim() || source,
      categorie: source,
      compte,
      date: new Date(date).toISOString(),
    });
    toast.success(`Revenu de ${formatFCFA(valeur)} enregistré.`);
    navigate({ to: "/" });
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Ajouter un revenu</h1>
        <p className="text-sm text-muted-foreground">Entrée d'argent dans le foyer</p>
      </header>

      <form onSubmit={enregistrer} className="space-y-4">
        <section className="carte p-4">
          <label htmlFor="montant" className="text-sm font-medium">
            Montant (FCFA)
          </label>
          <input
            id="montant"
            inputMode="numeric"
            value={montant}
            onChange={(ev) => setMontant(ev.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            className="mt-2 w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-2xl font-bold text-primary outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {MONTANTS_RAPIDES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMontant(String((Number(montant.replace(/[^\d]/g, "")) || 0) + m))}
                aria-label={`Ajouter ${formatFCFA(m)} au montant`}
                className="min-h-11 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
              >
                +{formatFCFA(m)}
              </button>
            ))}
          </div>
        </section>

        <section className="carte space-y-4 p-4">
          <div>
            <label htmlFor="source" className="text-sm font-medium">
              Source
            </label>
            <select
              id="source"
              value={source}
              onChange={(ev) => setSource(ev.target.value)}
              className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            >
              {sourcesRevenu.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="compte" className="text-sm font-medium">
              Compte crédité
            </label>
            <select
              id="compte"
              value={compte}
              onChange={(ev) => setCompte(ev.target.value)}
              className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            >
              {comptes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="libelle" className="text-sm font-medium">
              Libellé (facultatif)
            </label>
            <input
              id="libelle"
              value={libelle}
              onChange={(ev) => setLibelle(ev.target.value)}
              placeholder="Salaire du mois d'août"
              className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="date" className="text-sm font-medium">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(ev) => setDate(ev.target.value)}
              className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </section>

        <button
          type="submit"
          className="w-full rounded-2xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
        >
          Enregistrer le revenu
        </button>
      </form>
    </div>
  );
}
