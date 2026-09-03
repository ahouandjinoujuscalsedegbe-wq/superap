import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { echeancesDues } from "@/lib/echeances-dues";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/budget/confirmations")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Dépenses à confirmer — Budget familial" },
      {
        name: "description",
        content:
          "Confirmez ou annulez chaque dépense planifiée arrivée à échéance avant qu'elle ne soit comptée dans vos enveloppes.",
      },
      { property: "og:title", content: "Dépenses à confirmer" },
      {
        property: "og:description",
        content: "Validez vos dépenses planifiées avant leur prise en compte réelle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Page() {
  const { budgets, enveloppes, convertirBudget, reporterBudget } = useSuperApp();
  const [maintenant] = useState(() => new Date());
  const [traitees, setTraitees] = useState<string[]>([]);
  const dues = echeancesDues(budgets, maintenant).filter((d) => !traitees.includes(d.cle));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dépenses à confirmer</h1>
      <p className="text-sm text-muted-foreground">
        Une dépense planifiée n'est comptée dans vos enveloppes qu'après votre confirmation.
      </p>

      {dues.length === 0 && (
        <p className="rounded-xl bg-secondary/60 px-3 py-6 text-center text-sm">
          Aucune dépense planifiée n'attend votre confirmation.
        </p>
      )}

      <ul className="space-y-3">
        {dues.map((d) => {
          const env = enveloppes.find((e) => e.id === d.budget.enveloppeId);
          return (
            <li key={d.cle} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-semibold">
                {env?.emoji ? `${env.emoji} ` : ""}
                {d.budget.libelle}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatFCFA(d.budget.montant)} · {env?.nom ?? "Sans enveloppe"} · {d.budget.compte}
              </p>
              <p className="text-xs text-muted-foreground">
                Prévue le {d.quand.toLocaleDateString("fr-FR")}
                {d.budget.heure ? ` à ${d.budget.heure}` : ""}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    convertirBudget(d.budget.id, 1);
                    setTraitees((t) => [...t, d.cle]);
                    toast.success("Dépense confirmée et enregistrée.");
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  <CheckCircle2 aria-hidden className="h-4 w-4" />
                  Dépense réalisée
                </button>
                <button
                  type="button"
                  onClick={() => {
                    reporterBudget(d.budget.id);
                    setTraitees((t) => [...t, d.cle]);
                    toast.success("Dépense marquée comme non réalisée.");
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-destructive/50 py-3 text-sm font-semibold text-destructive"
                >
                  <XCircle aria-hidden className="h-4 w-4" />
                  Non réalisée
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
