import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PERIODES, useSuperApp, type Periode } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { nombreEcheancesDues, prochainesEcheances, equivalentMensuel } from "@/lib/periodes";

export const Route = createFileRoute("/enveloppes")({
  head: () => ({
    meta: [
      { title: "Enveloppes — Budgétisation et gestion en FCFA" },
      {
        name: "description",
        content:
          "Répartissez le budget du foyer en enveloppes, planifiez vos dépenses par période et modifiez vos enveloppes en francs CFA.",
      },
      { property: "og:title", content: "Enveloppes — SUPER APP" },
      {
        property: "og:description",
        content: "Enveloppes, budgétisation par période et gestion des plafonds en FCFA.",
      },
    ],
  }),
  component: Enveloppes,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

const libellePeriode = (p: Periode) => PERIODES.find((x) => x.id === p)?.label ?? p;

function Enveloppes() {
  const {
    enveloppes,
    depensesParEnveloppe,
    budgets,
    comptes,
    ajouterBudget,
    convertirBudget,
    genererEcheancesDues,
    supprimerBudget,
    ajouterEnveloppe,
    modifierEnveloppe,
    supprimerEnveloppe,
  } = useSuperApp();

  const totalPlafond = enveloppes.reduce((s, e) => s + e.plafond, 0);
  const totalUtilise = enveloppes.reduce((s, e) => s + (depensesParEnveloppe[e.id] ?? 0), 0);

  // Budgétisation
  const [periode, setPeriode] = useState<Periode>("mois");
  const [bLibelle, setBLibelle] = useState("");
  const [bEnveloppe, setBEnveloppe] = useState(enveloppes[0]?.id ?? "");
  const [bMontant, setBMontant] = useState("");
  const [bCompte, setBCompte] = useState(comptes[0] ?? "");
  const [bDate, setBDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Action (enveloppes)
  const [nom, setNom] = useState("");
  const [emoji, setEmoji] = useState("💡");
  const [plafond, setPlafond] = useState("");
  const [edition, setEdition] = useState<string | null>(null);
  const [eNom, setENom] = useState("");
  const [eEmoji, setEEmoji] = useState("");
  const [ePlafond, setEPlafond] = useState("");

  const budgetsPeriode = budgets.filter((b) => b.periode === periode);
  const totalPeriode = budgetsPeriode.reduce((s, b) => s + b.montant, 0);
  const totalMensuel = budgets.reduce((s, b) => s + equivalentMensuel(b), 0);
  const dues = budgets.map((b) => ({ b, n: b.actif ? nombreEcheancesDues(b) : 0 }));
  const nbDues = dues.reduce((s, d) => s + d.n, 0);
  const montantDu = dues.reduce((s, d) => s + d.n * d.b.montant, 0);
  const chronologie = prochainesEcheances(budgets, 10);

  function creerBudget(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = Number(bMontant);
    if (!bLibelle.trim()) {
      toast.error("Indiquez la dépense à planifier.");
      return;
    }
    if (!bEnveloppe) {
      toast.error("Choisissez une enveloppe.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur <= 0) {
      toast.error("Montant invalide : saisissez un montant positif en FCFA.");
      return;
    }
    if (!enveloppes.some((e) => e.id === bEnveloppe)) {
      toast.error("Enveloppe introuvable : choisissez une enveloppe existante.");
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
    ajouterBudget({
      libelle: bLibelle.trim(),
      enveloppeId: bEnveloppe,
      montant: valeur,
      periode,
      compte: bCompte,
      prochaine: debut.toISOString(),
      actif: true,
    });
    setBLibelle("");
    setBMontant("");
    toast.success("Dépense planifiée.");
  }

  function creerEnveloppe(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = Number(plafond);
    if (!nom.trim()) {
      toast.error("Donnez un nom à l'enveloppe.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur < 0) {
      toast.error("Plafond invalide.");
      return;
    }
    ajouterEnveloppe({ nom: nom.trim(), emoji: emoji.trim() || "💡", plafond: valeur });
    setNom("");
    setPlafond("");
    setEmoji("💡");
    toast.success("Enveloppe ajoutée.");
  }

  function validerEdition(id: string) {
    const valeur = Number(ePlafond);
    if (!eNom.trim()) {
      toast.error("Le nom ne peut pas être vide.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur < 0) {
      toast.error("Plafond invalide.");
      return;
    }
    modifierEnveloppe(id, {
      nom: eNom.trim(),
      emoji: eEmoji.trim() || "💡",
      plafond: valeur,
    });
    setEdition(null);
    toast.success("Enveloppe modifiée.");
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Enveloppes</h1>
        <p className="text-sm text-muted-foreground">
          {formatFCFA(totalUtilise)} utilisés sur {formatFCFA(totalPlafond)}
        </p>
      </header>

      <ul className="space-y-3">
        {enveloppes.map((e) => {
          const utilise = depensesParEnveloppe[e.id] ?? 0;
          const pourcentage = e.plafond > 0 ? Math.min(100, (utilise / e.plafond) * 100) : 0;
          const depasse = utilise > e.plafond;
          return (
            <li key={e.id} className="carte p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold">
                  <span aria-hidden className="text-xl">
                    {e.emoji}
                  </span>
                  {e.nom}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    depasse ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {formatFCFA(Math.max(0, e.plafond - utilise))} restants
                </span>
              </div>
              <div
                className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-valuenow={Math.round(pourcentage)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Consommation de l'enveloppe ${e.nom}`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    depasse ? "bg-destructive" : "bg-primary"
                  }`}
                  style={{ width: `${pourcentage}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatFCFA(utilise)} dépensés · plafond {formatFCFA(e.plafond)}
              </p>
            </li>
          );
        })}
      </ul>

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

      <section className="carte space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold">Chronologie & suivi</h2>
          <p className="text-sm text-muted-foreground">Prévu contre réellement dépensé.</p>
        </div>

        {chronologie.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune échéance à venir.</p>
        ) : (
          <ol className="relative space-y-3 border-l border-border pl-4">
            {chronologie.map(({ budget: b, date }) => (
              <li key={`${b.id}-${date}`} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[1.32rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary"
                />
                <p className="text-sm font-medium">
                  {formatDateFr(date)} · {b.libelle}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFCFA(b.montant)} · {libellePeriode(b.periode)} · {b.compte}
                </p>
              </li>
            ))}
          </ol>
        )}

        <ul className="space-y-3">
          {enveloppes.map((e) => {
            const prevu = budgets
              .filter((b) => b.enveloppeId === e.id)
              .reduce((s, b) => s + equivalentMensuel(b), 0);
            const reel = depensesParEnveloppe[e.id] ?? 0;
            const base = Math.max(prevu, reel, 1);
            return (
              <li key={e.id}>
                <div className="flex justify-between text-sm">
                  <span className="truncate">
                    <span aria-hidden>{e.emoji}</span> {e.nom}
                  </span>
                  <span className={reel > prevu ? "text-destructive" : "text-muted-foreground"}>
                    {formatFCFA(reel)} / {formatFCFA(prevu)}
                  </span>
                </div>
                <div className="mt-1 space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary/50"
                      style={{ width: `${(prevu / base) * 100}%` }}
                    />
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full ${reel > prevu ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${(reel / base) * 100}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Barre claire : budget mensualisé · barre pleine : dépenses réelles.
        </p>
      </section>

      <section className="carte space-y-4 p-4">
        <h2 className="text-lg font-semibold">Action</h2>

        <form onSubmit={creerEnveloppe} className="space-y-3">
          <div className="flex gap-2">
            <div className="w-20">
              <label htmlFor="e-emoji" className="text-sm font-medium">
                Emoji
              </label>
              <input
                id="e-emoji"
                value={emoji}
                onChange={(ev) => setEmoji(ev.target.value)}
                className={champ}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="e-nom" className="text-sm font-medium">
                Nouvelle enveloppe
              </label>
              <input
                id="e-nom"
                value={nom}
                onChange={(ev) => setNom(ev.target.value)}
                placeholder="Santé"
                className={champ}
              />
            </div>
          </div>

          <div>
            <label htmlFor="e-plafond" className="text-sm font-medium">
              Plafond (FCFA)
            </label>
            <input
              id="e-plafond"
              inputMode="numeric"
              value={plafond}
              onChange={(ev) => setPlafond(ev.target.value.replace(/[^\d]/g, ""))}
              placeholder="25000"
              className={champ}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
          >
            Ajouter l'enveloppe
          </button>
        </form>

        <ul className="space-y-2">
          {enveloppes.map((e) => (
            <li key={e.id} className="rounded-xl border border-border/70 p-3">
              {edition === e.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={eEmoji}
                      onChange={(ev) => setEEmoji(ev.target.value)}
                      aria-label="Emoji"
                      className={`${champ} w-16`}
                    />
                    <input
                      value={eNom}
                      onChange={(ev) => setENom(ev.target.value)}
                      aria-label="Nom de l'enveloppe"
                      className={champ}
                    />
                  </div>
                  <input
                    inputMode="numeric"
                    value={ePlafond}
                    onChange={(ev) => setEPlafond(ev.target.value.replace(/[^\d]/g, ""))}
                    aria-label="Plafond"
                    className={champ}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => validerEdition(e.id)}
                      className="flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEdition(null)}
                      className="flex-1 rounded-xl border border-input py-2 text-sm"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">
                    <span aria-hidden>{e.emoji}</span> {e.nom} · {formatFCFA(e.plafond)}
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEdition(e.id);
                        setENom(e.nom);
                        setEEmoji(e.emoji);
                        setEPlafond(String(e.plafond));
                      }}
                      className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        supprimerEnveloppe(e.id);
                        toast.success("Enveloppe supprimée.");
                      }}
                      className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-destructive"
                    >
                      Supprimer
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
