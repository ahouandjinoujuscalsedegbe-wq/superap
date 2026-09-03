import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";

export const Route = createFileRoute("/budget/modifier/")({
  head: () => ({
    meta: [
      { title: "Modifier une dépense planifiée — Budgétisation en FCFA" },
      {
        name: "description",
        content:
          "Choisissez une dépense déjà planifiée pour modifier son montant, sa périodicité, son enveloppe ou son compte, ou pour la supprimer.",
      },
      { property: "og:title", content: "Modifier une dépense planifiée — SUPER APP" },
      {
        property: "og:description",
        content: "Liste des dépenses planifiées existantes, prêtes à être modifiées.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ListeModification,
});

function ListeModification() {
  const { budgets, enveloppes } = useSuperApp();
  const liste = budgets
    .slice()
    .sort((a, z) => (a.debut ?? a.prochaine).localeCompare(z.debut ?? z.prochaine));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Modifier une dépense planifiée</h1>
      <p className="text-sm text-muted-foreground">
        Sélectionnez la dépense planifiée à corriger ou à supprimer.
      </p>

      {liste.length === 0 ? (
        <p className="carte p-4 text-sm text-muted-foreground">
          Aucune dépense planifiée pour le moment.
        </p>
      ) : (
        <ul className="space-y-2">
          {liste.map((b) => {
            const env = enveloppes.find((e) => e.id === b.enveloppeId);
            return (
              <li key={b.id}>
                <Link
                  to="/budget/modifier/$id"
                  params={{ id: b.id }}
                  className="carte flex items-center justify-between gap-2 p-3 active:scale-[0.99]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{b.libelle}</span>
                    <span className="block text-xs text-muted-foreground">
                      {env ? `${env.emoji} ${env.nom}` : "Enveloppe supprimée"} ·{" "}
                      {formatDateFr(b.prochaine)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">
                    {formatFCFA(b.montant)}
                    <ChevronRight aria-hidden className="h-4 w-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
