import { createFileRoute } from "@tanstack/react-router";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/enveloppes")({
  head: () => ({
    meta: [
      { title: "Enveloppes — Budget par catégorie en FCFA" },
      {
        name: "description",
        content:
          "Répartissez le budget du foyer en enveloppes virtuelles et suivez la consommation de chaque plafond en francs CFA.",
      },
      { property: "og:title", content: "Enveloppes — SUPER APP" },
      {
        property: "og:description",
        content: "Enveloppes virtuelles et plafonds de dépenses du foyer en FCFA.",
      },
    ],
  }),
  component: Enveloppes,
});

function Enveloppes() {
  const { enveloppes, depensesParEnveloppe } = useSuperApp();
  const totalPlafond = enveloppes.reduce((s, e) => s + e.plafond, 0);
  const totalUtilise = enveloppes.reduce(
    (s, e) => s + (depensesParEnveloppe[e.id] ?? 0),
    0,
  );

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
    </div>
  );
}
