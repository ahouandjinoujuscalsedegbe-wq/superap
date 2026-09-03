import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useSuperApp, type Budget, type Periode } from "@/lib/store";
import { PERIODES } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { prochainesEcheances, equivalentMensuel } from "@/lib/periodes";

function reculerDate(iso: string, periode: Periode): string {
  const d = new Date(iso);
  switch (periode) {
    case "jour":
      d.setDate(d.getDate() - 1);
      break;
    case "semaine":
      d.setDate(d.getDate() - 7);
      break;
    case "mois":
      d.setMonth(d.getMonth() - 1);
      break;
    case "trimestre":
      d.setMonth(d.getMonth() - 3);
      break;
    case "semestre":
      d.setMonth(d.getMonth() - 6);
      break;
    case "annee":
      d.setFullYear(d.getFullYear() - 1);
      break;
  }
  return d.toISOString();
}

export const Route = createFileRoute("/enveloppes/chronologie")({
  head: () => ({
    meta: [
      { title: "Chronologie et suivi — Prévu contre réel en FCFA" },
      {
        name: "description",
        content:
          "Visualisez les échéances budgétaires à venir et comparez le budget planifié aux dépenses réelles du foyer en francs CFA.",
      },
      { property: "og:title", content: "Chronologie et suivi — SUPER APP" },
      {
        property: "og:description",
        content:
          "Chronologie des échéances et comparaison budget prévu / dépenses réelles en FCFA.",
      },
    ],
  }),
  component: ChronologieSuivi,
});

const libellePeriode = (p: Periode) => PERIODES.find((x) => x.id === p)?.label ?? p;

function ChronologieSuivi() {
  const { enveloppes, depensesParEnveloppe, budgets, transactions } = useSuperApp();
  const chronologie = prochainesEcheances(budgets, 10);
  const [selection, setSelection] = useState<{ budget: Budget; date: string } | null>(null);

  return (
    <div className="space-y-5">
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
                <button
                  type="button"
                  onClick={() => setSelection({ budget: b, date })}
                  className="relative w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    aria-hidden
                    className="absolute -left-[1.82rem] top-2.5 h-2.5 w-2.5 rounded-full bg-primary"
                  />
                  <p className="text-sm font-medium">
                    {formatDateFr(date)} · {b.libelle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFCFA(b.montant)} · {libellePeriode(b.periode)} · {b.compte}
                  </p>
                </button>
              </li>
            ))}
          </ol>
        )}

        {selection && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Comparaison budget prévu contre réel"
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={() => setSelection(null)}
          >
            <div
              className="carte w-full max-w-md space-y-4 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{selection.budget.libelle}</h3>
                  <p className="text-xs text-muted-foreground">
                    Échéance du {formatDateFr(selection.date)} ·{" "}
                    {libellePeriode(selection.budget.periode)} · {selection.budget.compte}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelection(null)}
                  aria-label="Fermer"
                  className="rounded-full p-1.5 transition-colors hover:bg-secondary"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </div>

              {(() => {
                const debut = reculerDate(selection.date, selection.budget.periode);
                const reel = transactions
                  .filter(
                    (t) =>
                      t.type === "depense" &&
                      t.categorie === selection.budget.enveloppeId &&
                      new Date(t.date).getTime() > new Date(debut).getTime() &&
                      new Date(t.date).getTime() <= new Date(selection.date).getTime(),
                  )
                  .reduce((s, t) => s + t.montant, 0);
                const prevu = selection.budget.montant;
                const base = Math.max(prevu, reel, 1);
                const depasse = reel > prevu;
                return (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Période du {formatDateFr(debut)} au {formatDateFr(selection.date)}
                    </p>
                    <div className="flex justify-between text-sm">
                      <span>Budget prévu</span>
                      <span className="font-semibold">{formatFCFA(prevu)}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary/50"
                        style={{ width: `${(prevu / base) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Dépensé réel</span>
                      <span className={`font-semibold ${depasse ? "text-destructive" : ""}`}>
                        {formatFCFA(reel)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full ${depasse ? "bg-destructive" : "bg-primary"}`}
                        style={{ width: `${(reel / base) * 100}%` }}
                      />
                    </div>
                    <p
                      className={`rounded-lg px-3 py-2 text-center text-sm font-medium ${
                        depasse
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {depasse
                        ? `Dépassement de ${formatFCFA(reel - prevu)}`
                        : `Reste disponible : ${formatFCFA(prevu - reel)}`}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
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
    </div>
  );
}
