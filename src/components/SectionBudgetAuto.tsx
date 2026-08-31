import { useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { ajusterAuRevenu, proposerDotations } from "@/lib/budget-auto";

/**
 * Budget auto-proposé : calcul local des dotations conseillées pour le mois
 * suivant, avec application en un appui. Aucune donnée ne sort du téléphone.
 */
export function SectionBudgetAuto() {
  const { transactions, enveloppes, modifierEnveloppe } = useSuperApp();
  const [ajuster, setAjuster] = useState(true);

  const budget = useMemo(() => {
    const brut = proposerDotations(transactions, enveloppes);
    return ajuster ? ajusterAuRevenu(brut) : brut;
  }, [transactions, enveloppes, ajuster]);

  const appliquer = () => {
    let modifiees = 0;
    for (const p of budget.propositions) {
      const env = enveloppes.find((e) => e.id === p.enveloppeId);
      if (!env || p.proposee <= 0 || p.proposee === p.actuelle) continue;
      modifierEnveloppe(env.id, {
        dotation: p.proposee,
        plafond: Math.min(env.plafond, p.proposee),
      });
      modifiees += 1;
    }
    toast.success(
      modifiees > 0
        ? `${modifiees} enveloppe(s) mise(s) à jour avec le budget proposé.`
        : "Vos dotations correspondent déjà aux propositions.",
    );
  };

  if (budget.propositions.length === 0) return null;

  return (
    <section className="carte space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Wand2 className="h-4 w-4 text-primary" aria-hidden />
        Budget auto-proposé
      </h2>
      <p className="text-xs text-muted-foreground">
        Calculé sur votre téléphone à partir de vos trois derniers mois.
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

      <ul className="space-y-1.5 text-sm">
        {budget.propositions.map((p) => (
          <li key={p.enveloppeId} className="rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">
                {p.emoji} {p.nom}
              </span>
              <span className="shrink-0 font-semibold">
                {formatFCFA(p.actuelle)} → {formatFCFA(p.proposee)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{p.raison}</p>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Total proposé : {formatFCFA(budget.totalPropose)} (actuel {formatFCFA(budget.totalActuel)}).
      </p>

      <button
        type="button"
        onClick={appliquer}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
      >
        Appliquer ce budget
      </button>
    </section>
  );
}
