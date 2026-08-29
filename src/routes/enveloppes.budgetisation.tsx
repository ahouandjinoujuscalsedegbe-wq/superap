import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PERIODES, useSuperApp, type Periode } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { nombreEcheancesDues, equivalentMensuel } from "@/lib/periodes";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";

export const Route = createFileRoute("/enveloppes/budgetisation")({
  head: () => ({
    meta: [
      { title: "Budgétisation — Planification des dépenses en FCFA" },
      {
        name: "description",
        content:
          "Planifiez les dépenses du foyer période par période : jour, semaine, mois, trimestre, semestre ou année, en francs CFA.",
      },
      { property: "og:title", content: "Budgétisation — SUPER APP" },
      {
        property: "og:description",
        content: "Planification des dépenses par période et conversion en dépenses réelles en FCFA.",
      },
    ],
  }),
  component: Budgetisation,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

const libellePeriode = (p: Periode) => PERIODES.find((x) => x.id === p)?.label ?? p;

function Budgetisation() {
  const {
    enveloppes,
    budgets,
    comptes,
    ajouterBudget,
    convertirBudget,
    genererEcheancesDues,
    supprimerBudget,
  } = useSuperApp();

  type Demande =
    | { type: "creation"; libelle: string; enveloppeId: string; montant: number; compte: string; prochaine: string }
    | { type: "conversion-tout"; nb: number; montant: number }
    | { type: "conversion-un"; id: string; libelle: string; montant: number }
    | { type: "suppression"; id: string; libelle: string }
    | null;
  const [demande, setDemande] = useState<Demande>(null);

  const [periode, setPeriode] = useState<Periode>("mois");
  const [bLibelle, setBLibelle] = useState("");
  const [bEnveloppe, setBEnveloppe] = useState(enveloppes[0]?.id ?? "");
  const [bMontant, setBMontant] = useState("");
  const [bCompte, setBCompte] = useState(comptes[0] ?? "");
  const [bDate, setBDate] = useState(() => new Date().toISOString().slice(0, 10));

  const budgetsPeriode = budgets.filter((b) => b.periode === periode);
  const totalPeriode = budgetsPeriode.reduce((s, b) => s + b.montant, 0);
  const totalMensuel = budgets.reduce((s, b) => s + equivalentMensuel(b), 0);
  const dues = budgets.map((b) => ({ b, n: b.actif ? nombreEcheancesDues(b) : 0 }));
  const nbDues = dues.reduce((s, d) => s + d.n, 0);
  const montantDu = dues.reduce((s, d) => s + d.n * d.b.montant, 0);

  function creerBudget(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = Number(bMontant);
    if (!bLibelle.trim()) {
      toast.error("Indiquez la dépense à planifier.");
      return;
    }
    if (!bEnveloppe || !enveloppes.some((e) => e.id === bEnveloppe)) {
      toast.error("Enveloppe introuvable : choisissez une enveloppe existante.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur <= 0) {
      toast.error("Montant invalide : saisissez un montant positif en FCFA.");
      return;
    }
    if (!bCompte) {
      toast.error("Choisissez le compte à débiter.");
      return;
    }
    const debut = new Date(`${bDate}T08:00:00`);
    if (Number.isNaN(debut.getTime())) {
      toast.error("Date de première échéance invalide.");
      return;
    }
    setDemande({
      type: "creation",
      libelle: bLibelle.trim(),
      enveloppeId: bEnveloppe,
      montant: valeur,
      compte: bCompte,
      prochaine: debut.toISOString(),
    });
  }

  function confirmer() {
    if (!demande) return;
    if (demande.type === "creation") {
      ajouterBudget({
        libelle: demande.libelle,
        enveloppeId: demande.enveloppeId,
        montant: demande.montant,
        periode,
        compte: demande.compte,
        prochaine: demande.prochaine,
        actif: true,
      });
      setBLibelle("");
      setBMontant("");
      toast.success("Dépense planifiée.");
    } else if (demande.type === "conversion-tout") {
      genererEcheancesDues();
      toast.success("Dépenses réelles générées.");
    } else if (demande.type === "conversion-un") {
      convertirBudget(demande.id);
      toast.success("Dépense réelle créée.");
    } else {
      supprimerBudget(demande.id);
      toast.success("Dépense planifiée supprimée.");
    }
    setDemande(null);
  }

  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/" label="Retour aux enveloppes" />
      <section className="carte space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold">Budgétisation</h2>
          <p className="text-sm text-muted-foreground">
            Planifiez vos dépenses période par période.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PERIODES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriode(p.id)}
              aria-pressed={periode === p.id}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                periode === p.id
                  ? "bg-primary text-primary-foreground"
                  : "border border-input text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <form onSubmit={creerBudget} className="space-y-3">
          <div>
            <label htmlFor="b-libelle" className="text-sm font-medium">
              Dépense planifiée
            </label>
            <input
              id="b-libelle"
              value={bLibelle}
              onChange={(ev) => setBLibelle(ev.target.value)}
              placeholder="Loyer, école, carburant…"
              className={champ}
            />
          </div>

          <div>
            <label htmlFor="b-enveloppe" className="text-sm font-medium">
              Enveloppe
            </label>
            <select
              id="b-enveloppe"
              value={bEnveloppe}
              onChange={(ev) => setBEnveloppe(ev.target.value)}
              className={champ}
            >
              {enveloppes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.emoji} {e.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="b-montant" className="text-sm font-medium">
              Montant {libellePeriode(periode).toLowerCase()} (FCFA)
            </label>
            <input
              id="b-montant"
              inputMode="numeric"
              value={bMontant}
              onChange={(ev) => setBMontant(ev.target.value.replace(/[^\d]/g, ""))}
              placeholder="50000"
              className={champ}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="b-compte" className="text-sm font-medium">
                Compte débité
              </label>
              <select
                id="b-compte"
                value={bCompte}
                onChange={(ev) => setBCompte(ev.target.value)}
                className={champ}
              >
                {comptes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="b-date" className="text-sm font-medium">
                1re échéance
              </label>
              <input
                id="b-date"
                type="date"
                value={bDate}
                onChange={(ev) => setBDate(ev.target.value)}
                className={champ}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
          >
            Planifier
          </button>
        </form>

        <div className="rounded-xl bg-secondary/60 p-3 text-sm">
          <p className="font-semibold">
            Total {libellePeriode(periode).toLowerCase()} : {formatFCFA(totalPeriode)}
          </p>
          <p className="text-xs text-muted-foreground">
            Équivalent mensuel de tout le plan : {formatFCFA(totalMensuel)}
          </p>
        </div>

        {nbDues > 0 && (
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
            <p className="text-sm font-semibold">
              {nbDues} échéance{nbDues > 1 ? "s" : ""} à générer · {formatFCFA(montantDu)}
            </p>
            <button
              type="button"
              onClick={() => {
                genererEcheancesDues();
                toast.success("Dépenses réelles générées.");
              }}
              className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Convertir en dépenses réelles
            </button>
          </div>
        )}

        {budgetsPeriode.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune dépense planifiée pour cette période.
          </p>
        ) : (
          <ul className="space-y-2">
            {budgetsPeriode.map((b) => {
              const env = enveloppes.find((e) => e.id === b.enveloppeId);
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/70 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.libelle}</p>
                    <p className="text-xs text-muted-foreground">
                      {env ? `${env.emoji} ${env.nom}` : "Enveloppe supprimée"} ·{" "}
                      {libellePeriode(b.periode)} · {b.compte}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Prochaine échéance : {formatDateFr(b.prochaine)}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        convertirBudget(b.id);
                        toast.success("Dépense réelle créée.");
                      }}
                      className="mt-1.5 rounded-lg border border-input px-2.5 py-1 text-xs font-medium"
                    >
                      Convertir maintenant
                    </button>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold">{formatFCFA(b.montant)}</span>
                    <button
                      type="button"
                      onClick={() => supprimerBudget(b.id)}
                      aria-label={`Supprimer ${b.libelle}`}
                      className="rounded-lg border border-input px-2 py-1 text-xs text-destructive"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
