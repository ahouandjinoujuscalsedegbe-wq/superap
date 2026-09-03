import { useEffect, useMemo, useState } from "react";
import { Pencil, RotateCcw, Star, TrendingDown, TrendingUp, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, grouperMontant } from "@/lib/format";
import {
  ajusterAuRevenu,
  apprendreCorrections,
  noterBudget,
  proposerDotations,
} from "@/lib/budget-auto";
import { marquerBudgetModifie } from "@/lib/rappel-budget";

/** Périodes proposées avant tout calcul de budget. */
const PERIODES_BUDGET = [
  { mois: 1, label: "1 mois" },
  { mois: 3, label: "3 mois (trimestre)" },
  { mois: 6, label: "6 mois (semestre)" },
  { mois: 12, label: "12 mois (année)" },
] as const;

/**
 * Budget auto-proposé : calcul local des dotations conseillées pour le mois
 * suivant. L'utilisateur peut corriger chaque montant avant d'appliquer, et
 * le moteur retient ses corrections pour affiner ses prochains conseils.
 */
export function SectionBudgetAuto() {
  const { transactions, enveloppes, modifierEnveloppe } = useSuperApp();
  const [ajuster, setAjuster] = useState(true);
  /** Période choisie par l'utilisateur AVANT toute génération (en mois). */
  const [periodeMois, setPeriodeMois] = useState<number | null>(null);
  const [modeEdition, setModeEdition] = useState(false);
  /** Montants retenus par l'utilisateur (chaîne brute par enveloppe). */
  const [retenus, setRetenus] = useState<Record<string, string>>({});
  const [ignorees, setIgnorees] = useState<Record<string, boolean>>({});
  /** Réponse à « Voulez-vous modifier ce budget ? ». */
  const [reponse, setReponse] = useState<"oui" | "non" | null>(null);
  /** Action en attente de la notation obligatoire. */
  const [notation, setNotation] = useState<"appliquer" | "modifier" | null>(null);
  const [note, setNote] = useState<number | null>(null);

  const budget = useMemo(() => {
    const brut = proposerDotations(transactions, enveloppes);
    return ajuster ? ajusterAuRevenu(brut) : brut;
  }, [transactions, enveloppes, ajuster]);

  // Chaque nouvelle proposition réinitialise les champs modifiables.
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const p of budget.propositions) initial[p.enveloppeId] = String(p.proposee);
    setRetenus(initial);
  }, [budget]);

  const valeurRetenue = (id: string, defaut: number) => {
    const brut = retenus[id];
    if (brut === undefined) return defaut;
    return Number(brut.replace(/[^\d]/g, "")) || 0;
  };

  const totalRetenu = budget.propositions.reduce(
    (s, p) => s + (ignorees[p.enveloppeId] ? p.actuelle : valeurRetenue(p.enveloppeId, p.proposee)),
    0,
  );
  const modifieParUtilisateur = budget.propositions.some(
    (p) => ignorees[p.enveloppeId] || valeurRetenue(p.enveloppeId, p.proposee) !== p.proposee,
  );

  const reinitialiser = () => {
    const initial: Record<string, string> = {};
    for (const p of budget.propositions) initial[p.enveloppeId] = String(p.proposee);
    setRetenus(initial);
    setIgnorees({});
    toast.info("Propositions rétablies telles que calculées.");
  };

  const appliquer = () => {
    let modifiees = 0;
    const corrections: { enveloppeId: string; proposee: number; retenue: number }[] = [];

    for (const p of budget.propositions) {
      if (ignorees[p.enveloppeId]) continue;
      const env = enveloppes.find((e) => e.id === p.enveloppeId);
      const montant = valeurRetenue(p.enveloppeId, p.proposee);
      if (!env || montant <= 0) continue;
      if (montant !== p.proposee) {
        corrections.push({ enveloppeId: p.enveloppeId, proposee: p.proposee, retenue: montant });
      }
      if (montant === p.actuelle) continue;
      modifierEnveloppe(env.id, {
        dotation: montant,
        plafond: Math.min(env.plafond, montant),
      });
      modifiees += 1;
    }

    // L'application retient les corrections pour ses prochaines propositions.
    if (corrections.length > 0) apprendreCorrections(corrections);

    // Le budget du mois est validé par l'utilisateur : les rappels s'arrêtent.
    marquerBudgetModifie();

    toast.success(
      modifiees > 0
        ? `${modifiees} enveloppe(s) mise(s) à jour${corrections.length > 0 ? " — vos corrections sont mémorisées." : "."}`
        : "Vos dotations correspondent déjà aux montants retenus.",
    );
  };

  /** La notation est obligatoire avant d'appliquer ou de modifier le budget. */
  const validerNote = () => {
    if (note === null) return;
    const action = notation;
    noterBudget({
      note,
      totalPropose: budget.totalPropose,
      modifie: action === "modifier",
    });
    setNotation(null);
    setNote(null);
    if (action === "modifier") {
      setModeEdition(true);
      toast.success("Note enregistrée : vous pouvez modifier le budget.");
    } else if (action === "appliquer") {
      appliquer();
    }
  };

  if (periodeMois === null) {
    return (
      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wand2 className="h-4 w-4 text-primary" aria-hidden />
          Budget auto-proposé
        </h2>
        <p className="text-xs text-muted-foreground">
          Choisissez d'abord la période sur laquelle vous voulez ce budget. La proposition sera
          ensuite calculée sur votre téléphone.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PERIODES_BUDGET.map((p) => (
            <button
              key={p.mois}
              type="button"
              onClick={() => setPeriodeMois(p.mois)}
              className="rounded-xl border border-border bg-secondary/50 px-3 py-3 text-sm font-semibold"
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (budget.propositions.length === 0) return null;

  const libellePeriode =
    PERIODES_BUDGET.find((p) => p.mois === periodeMois)?.label ?? `${periodeMois} mois`;

  return (
    <section className="carte space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Wand2 className="h-4 w-4 text-primary" aria-hidden />
        Budget auto-proposé
      </h2>
      <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-xs">
        <span>
          Période choisie : <span className="font-semibold">{libellePeriode}</span>
        </span>
        <button
          type="button"
          onClick={() => setPeriodeMois(null)}
          className="shrink-0 font-semibold text-primary"
        >
          Changer
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Calculé sur votre téléphone à partir de vos six derniers mois : rythme récent, tendance et
        régularité de chaque enveloppe.
        {budget.donneesInsuffisantes && " Historique encore court : proposition indicative."}
      </p>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={ajuster}
          onChange={(e) => setAjuster(e.target.checked)}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        Ajuster au revenu moyen ({formatFCFA(budget.revenuMoyen)} / mois)
      </label>

      <ul className="space-y-2 text-sm">
        {budget.propositions.map((p) => {
          const ignoree = Boolean(ignorees[p.enveloppeId]);
          const montant = valeurRetenue(p.enveloppeId, p.proposee);
          const corrige = !ignoree && montant !== p.proposee;
          return (
            <li key={p.enveloppeId} className="rounded-lg bg-muted/50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {p.emoji} {p.nom}
                  {p.tendance === "hausse" && (
                    <TrendingUp
                      className="ml-1 inline h-3.5 w-3.5 text-destructive"
                      aria-label="En hausse"
                    />
                  )}
                  {p.tendance === "baisse" && (
                    <TrendingDown
                      className="ml-1 inline h-3.5 w-3.5 text-emerald-600"
                      aria-label="En baisse"
                    />
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  actuel {formatFCFA(p.actuelle)}
                </span>
              </div>

              {modeEdition ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <label className="sr-only" htmlFor={`prop-${p.enveloppeId}`}>
                    Montant retenu pour {p.nom}
                  </label>
                  <input
                    id={`prop-${p.enveloppeId}`}
                    inputMode="numeric"
                    disabled={ignoree}
                    value={grouperMontant(retenus[p.enveloppeId] ?? String(p.proposee))}
                    onChange={(e) =>
                      setRetenus((r) => ({
                        ...r,
                        [p.enveloppeId]: e.target.value.replace(/[^\d]/g, ""),
                      }))
                    }
                    className="w-40 rounded-lg border border-input bg-background px-3 py-2 text-right text-sm font-semibold disabled:opacity-50"
                  />
                  <span className="text-xs text-muted-foreground">FCFA</span>
                  <button
                    type="button"
                    onClick={() =>
                      setIgnorees((g) => ({ ...g, [p.enveloppeId]: !g[p.enveloppeId] }))
                    }
                    className="ml-auto min-h-9 rounded-full bg-secondary px-3 text-xs font-medium text-secondary-foreground"
                  >
                    {ignoree ? "Inclure" : "Ne pas changer"}
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-sm font-semibold">
                  {formatFCFA(p.actuelle)} → {formatFCFA(p.proposee)}
                </p>
              )}

              <p className="mt-1 text-xs text-muted-foreground">
                {p.raison}
                {modeEdition && corrige && " Montant corrigé par vous."}
              </p>
            </li>
          );
        })}
      </ul>

      {periodeMois > 1 && (
        <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs">
          Sur {libellePeriode}, ce budget représente{" "}
          <span className="font-semibold">{formatFCFA(totalRetenu * periodeMois)}</span> (
          {formatFCFA(totalRetenu)} par mois).
        </p>
      )}

      {modeEdition && (
        <p className="text-xs text-muted-foreground">
          Total retenu : {formatFCFA(totalRetenu)} (proposé {formatFCFA(budget.totalPropose)},
          actuel {formatFCFA(budget.totalActuel)}).
          {budget.revenuMoyen > 0 && totalRetenu > budget.revenuMoyen && (
            <span className="text-destructive">
              {" "}
              Attention : dépasse votre revenu moyen de{" "}
              {formatFCFA(totalRetenu - budget.revenuMoyen)}.
            </span>
          )}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {reponse === null ? (
          <div className="space-y-2">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold">
              <Pencil className="h-4 w-4 text-primary" aria-hidden />
              Voulez-vous modifier ce budget ?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReponse("oui")}
                className="min-h-11 flex-1 rounded-xl border border-primary bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-transform active:scale-[0.99]"
              >
                Oui
              </button>
              <button
                type="button"
                onClick={() => setReponse("non")}
                className="min-h-11 flex-1 rounded-xl border border-input px-4 py-2.5 text-sm font-semibold transition-transform active:scale-[0.99]"
              >
                Non
              </button>
            </div>
          </div>
        ) : reponse === "non" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setReponse(null)}
              className="min-h-11 rounded-xl bg-secondary px-3 text-sm font-medium text-secondary-foreground"
            >
              Revenir
            </button>
            <button
              type="button"
              onClick={() => setNotation("appliquer")}
              className="min-h-11 flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
            >
              Appliquer ce budget
            </button>
          </div>
        ) : !modeEdition ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setReponse(null)}
              className="min-h-11 rounded-xl bg-secondary px-3 text-sm font-medium text-secondary-foreground"
            >
              Revenir
            </button>
            <button
              type="button"
              onClick={() => setNotation("modifier")}
              className="min-h-11 flex-1 rounded-xl border border-primary bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-transform active:scale-[0.99]"
            >
              <span className="flex items-center justify-center gap-2">
                <Pencil className="h-4 w-4" aria-hidden />
                Modifier
              </span>
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            {modifieParUtilisateur && (
              <button
                type="button"
                onClick={reinitialiser}
                className="flex min-h-11 items-center gap-1.5 rounded-xl bg-secondary px-3 text-sm font-medium text-secondary-foreground"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Rétablir
              </button>
            )}
            <button
              type="button"
              onClick={appliquer}
              className="min-h-11 flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
            >
              Appliquer ce budget
            </button>
          </div>
        )}
      </div>

      {notation && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Notation du budget proposé"
        >
          <div className="carte w-full max-w-sm space-y-3 p-4">
            <h3 className="text-sm font-semibold">Notez le budget proposé</h3>
            <p className="text-xs text-muted-foreground">
              Notation obligatoire : elle entraîne l'application à mieux proposer vos prochains
              budgets. Total proposé : {formatFCFA(budget.totalPropose)}.
            </p>
            <div className="flex justify-between gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNote(n)}
                  aria-pressed={note === n}
                  aria-label={`Note ${n} sur 5`}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold ${
                    note !== null && n <= note
                      ? "bg-primary text-primary-foreground"
                      : "border border-input text-muted-foreground"
                  }`}
                >
                  <Star className="h-4 w-4" aria-hidden />
                  {n}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setNotation(null);
                  setNote(null);
                }}
                className="min-h-11 flex-1 rounded-xl border border-input text-sm font-medium"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={note === null}
                onClick={validerNote}
                className="min-h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
