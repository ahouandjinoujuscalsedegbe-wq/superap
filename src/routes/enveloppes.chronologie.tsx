import { createFileRoute } from "@tanstack/react-router";
import { useSuperApp, type Periode } from "@/lib/store";
import { PERIODES } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { prochainesEcheances, equivalentMensuel } from "@/lib/periodes";

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
        content: "Chronologie des échéances et comparaison budget prévu / dépenses réelles en FCFA.",
      },
    ],
  }),
  component: ChronologieSuivi,
});

const libellePeriode = (p: Periode) => PERIODES.find((x) => x.id === p)?.label ?? p;

function ChronologieSuivi() {
  const { enveloppes, depensesParEnveloppe, budgets } = useSuperApp();
  const chronologie = prochainesEcheances(budgets, 10);

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
    </div>
  );
}
