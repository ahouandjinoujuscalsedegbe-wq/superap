import { createFileRoute } from "@tanstack/react-router";
import { FormulaireBudget } from "@/components/FormulaireBudget";

export const Route = createFileRoute("/budget/modifier/$id")({
  head: () => ({
    meta: [
      { title: "Modifier une dépense planifiée — Budgétisation en FCFA" },
      {
        name: "description",
        content:
          "Corrigez le sujet, le montant, la périodicité, l'enveloppe ou le compte d'une dépense déjà planifiée, ou supprimez-la.",
      },
      { property: "og:title", content: "Modifier une dépense planifiée — SUPER APP" },
      {
        property: "og:description",
        content: "Modification complète d'une prévision de dépense existante.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageModification,
});

function PageModification() {
  const { id } = Route.useParams();
  return <FormulaireBudget budgetId={id} />;
}
