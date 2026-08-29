import { createFileRoute } from "@tanstack/react-router";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { equivalentMensuel } from "@/lib/periodes";

export const Route = createFileRoute("/enveloppes/details")({
  head: () => ({
    meta: [
      { title: "Détails actuels — Paramètres des enveloppes en FCFA" },
      {
        name: "description",
        content:
          "Consultez les détails actuels de chaque enveloppe budgétaire : plafond, contenu, reste disponible et budget prévu en francs CFA.",
      },
      { property: "og:title", content: "Détails actuels — SUPER APP" },
      {
        property: "og:description",
        content: "Vue détaillée des enveloppes, de leurs paramètres et de leur contenu en FCFA.",
      },
    ],
  }),
  component: DetailsActuels,
});

function DetailsActuels() {
  const { enveloppes, depensesParEnveloppe, budgets, transactions } = useSuperApp();

  return (
    <div className="space-y-5">
      <section className="carte space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold">Détails actuels</h2>
          <p className="text-sm text-muted-foreground">
            Les enveloppes, leurs paramètres et leur contenu.
          </p>
        </div>

        {enveloppes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune enveloppe pour le moment.</p>
        ) : (
          <ul className="space-y-3">
            {enveloppes.map((e) => {
              const utilise = depensesParEnveloppe[e.id] ?? 0;
              const pourcentage = e.plafond > 0 ? Math.min(100, (utilise / e.plafond) * 100) : 0;
              const depasse = utilise > e.plafond;
              const planifie = budgets.filter((b) => b.enveloppeId === e.id);
              const prevuMensuel = planifie.reduce((s, b) => s + equivalentMensuel(b), 0);
              const nbOperations = transactions.filter((t) => t.categorie === e.id).length;
              return (
                <li key={e.id} className="rounded-xl border border-border/70 p-4">
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
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <div>
                      <dt className="inline">Plafond : </dt>
                      <dd className="inline font-medium text-foreground">
                        {formatFCFA(e.plafond)}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Dépensé : </dt>
                      <dd className="inline font-medium text-foreground">
                        {formatFCFA(utilise)}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Dépenses planifiées : </dt>
                      <dd className="inline font-medium text-foreground">
                        {planifie.length} · {formatFCFA(prevuMensuel)}/mois
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Opérations réelles : </dt>
                      <dd className="inline font-medium text-foreground">{nbOperations}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
