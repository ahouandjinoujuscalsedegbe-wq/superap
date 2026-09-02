import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LifeBuoy, ShieldAlert, ArrowRight } from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";
import { formatFCFA } from "@/lib/format";
import { plansSecours } from "@/lib/sauvetage";
import { useSuperApp } from "@/lib/store";

export const Route = createFileRoute("/enveloppes/secours")({
  head: () => ({
    meta: [
      { title: "Plan de secours — Enveloppes épuisées et solutions" },
      {
        name: "description",
        content:
          "Quand une enveloppe a épuisé son plafond et sa réserve, l'intelligence locale explique la situation et propose des transferts sûrs depuis d'autres enveloppes, en FCFA.",
      },
      { property: "og:title", content: "Plan de secours des enveloppes — SUPER APP" },
      {
        property: "og:description",
        content:
          "Analyse, explications et transferts proposés pour sortir d'une enveloppe épuisée sans déficit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Secours,
});

function Secours() {
  const { enveloppes, transactions, depensesParEnveloppe, transfererEntreEnveloppes } =
    useSuperApp();
  const [faits, setFaits] = useState<string[]>([]);

  const plans = useMemo(
    () => plansSecours(enveloppes, depensesParEnveloppe, transactions),
    [enveloppes, depensesParEnveloppe, transactions],
  );

  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/action" label="Retour à Action" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Plan de secours</h1>
        <p className="text-sm text-muted-foreground">
          Enveloppes dont le plafond et la réserve sont épuisés : analyse, explication et transferts
          sûrs proposés par l'intelligence locale.
        </p>
      </header>

      {plans.length === 0 ? (
        <p className="carte p-4 text-sm text-muted-foreground">
          Aucune enveloppe en détresse pour l'instant. Vos dépenses restent dans les limites
          prévues.
        </p>
      ) : (
        plans.map((p) => (
          <section key={p.enveloppe.id} className="carte space-y-3 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <ShieldAlert aria-hidden className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold">
                  <span aria-hidden>{p.enveloppe.emoji}</span> {p.enveloppe.nom}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Manque estimé : <strong>{formatFCFA(p.manque)}</strong>
                  {p.depassement > 0 ? ` · dépassement ${formatFCFA(p.depassement)}` : ""}
                </p>
              </div>
            </div>

            <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">{p.explication}</p>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-primary">
                Enveloppes qui peuvent aider
              </h3>

              {p.donneurs.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucune enveloppe ne dispose d'un surplus mobilisable.
                </p>
              ) : (
                p.donneurs.map((d) => {
                  const cle = `${p.enveloppe.id}-${d.enveloppe.id}`;
                  const fait = faits.includes(cle);
                  return (
                    <article key={cle} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2 text-sm font-medium">
                        <span className="min-w-0 truncate">
                          <span aria-hidden>{d.enveloppe.emoji}</span> {d.enveloppe.nom}
                        </span>
                        <span className="shrink-0 text-primary">
                          {formatFCFA(d.montantPropose)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{d.raison}</p>
                      {d.prioritaire && (
                        <p className="mt-1 text-[11px] font-medium text-amber-600">
                          Enveloppe sensible — à mobiliser en dernier.
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={fait}
                        onClick={() => {
                          transfererEntreEnveloppes(
                            d.enveloppe.id,
                            p.enveloppe.id,
                            d.montantPropose,
                          );
                          setFaits((l) => [...l, cle]);
                        }}
                        className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                        {fait ? "Transfert effectué" : "Appliquer ce transfert"}
                      </button>
                    </article>
                  );
                })
              )}
            </div>

            <p className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-xs leading-relaxed">
              <LifeBuoy aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{p.conseil}</span>
            </p>
          </section>
        ))
      )}
    </div>
  );
}
