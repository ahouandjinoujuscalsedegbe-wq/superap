import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { COMPTES, useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { etatEnveloppe } from "@/lib/enveloppe-etat";

export const Route = createFileRoute("/depense")({
  head: () => ({
    meta: [
      { title: "Ajouter une dépense — Saisie rapide en FCFA" },
      {
        name: "description",
        content:
          "Saisissez une dépense du foyer en moins de trois secondes : montant, enveloppe et compte, en francs CFA.",
      },
      { property: "og:title", content: "Ajouter une dépense — SUPER APP" },
      {
        property: "og:description",
        content: "Saisie rapide des dépenses du foyer par enveloppe, en francs CFA.",
      },
    ],
  }),
  component: AjouterDepense,
});

const MONTANTS_RAPIDES = [500, 1000, 2000, 5000, 10000];

function AjouterDepense() {
  const { ajouterTransaction, enveloppes, comptes, depensesParEnveloppe } = useSuperApp();
  const navigate = useNavigate();
  const [montant, setMontant] = useState("");
  const [libelle, setLibelle] = useState("");
  const [enveloppe, setEnveloppe] = useState<string>(enveloppes[0]?.id ?? "vitaux");
  const [compte, setCompte] = useState<string>(comptes[0] ?? COMPTES[0]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const valeur = Number(montant.replace(/\s/g, "")) || 0;

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (valeur <= 0) {
      toast.error("Veuillez saisir un montant valide.");
      return;
    }
    const env = enveloppes.find((x) => x.id === enveloppe);
    ajouterTransaction({
      type: "depense",
      montant: valeur,
      libelle: libelle.trim() || (env?.nom ?? "Dépense"),
      categorie: enveloppe,
      compte,
      date: new Date(date).toISOString(),
    });
    toast.success(`Dépense de ${formatFCFA(valeur)} enregistrée.`);
    if (env) {
      const apres = etatEnveloppe(env, (depensesParEnveloppe[env.id] ?? 0) + valeur);
      if (apres.epuisee) {
        toast.error(
          `Enveloppe « ${env.nom} » épuisée : la somme attribuée et la réserve sont entièrement consommées.`,
        );
      } else if (apres.plafondAtteint) {
        toast.warning(
          `Zone rouge : le plafond de ${formatFCFA(env.plafond)} de « ${env.nom} » est atteint. Vous puisez maintenant dans la réserve (${formatFCFA(apres.reserveDisponible)} disponibles).`,
        );
      }
    }
    navigate({ to: "/" });
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Ajouter une dépense</h1>
        <p className="text-sm text-muted-foreground">Sortie d'argent du foyer</p>
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
            className="mt-2 w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-2xl font-bold text-destructive outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {MONTANTS_RAPIDES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMontant(String((Number(montant) || 0) + m))}
                className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
              >
                +{formatFCFA(m)}
              </button>
            ))}
          </div>
        </section>

        <section className="carte p-4">
          <p className="text-sm font-medium">Enveloppe</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {enveloppes.map((e) => {
              const actif = e.id === enveloppe;
              return (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => setEnveloppe(e.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    actif
                      ? "border-primary bg-accent font-semibold text-accent-foreground"
                      : "border-input bg-background/60 text-muted-foreground"
                  }`}
                >
                  <span aria-hidden className="text-base">
                    {e.emoji}
                  </span>
                  <span className="truncate">{e.nom}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="carte space-y-4 p-4">
          <div>
            <label htmlFor="compte" className="text-sm font-medium">
              Compte débité
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
              placeholder="Pain, taxi, recharge téléphonique…"
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
          Enregistrer la dépense
        </button>
      </form>
    </div>
  );
}
