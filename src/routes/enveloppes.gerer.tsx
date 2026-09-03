import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/enveloppes/gerer")({
  head: () => ({
    meta: [
      { title: "Modifier une enveloppe existante — SUPER APP" },
      {
        name: "description",
        content: "Modifiez ou supprimez une enveloppe budgétaire existante.",
      },
      { property: "og:title", content: "Modifier une enveloppe existante — SUPER APP" },
      {
        property: "og:description",
        content: "Modification et suppression des enveloppes budgétaires en FCFA.",
      },
    ],
  }),
  component: () => <Navigate to="/enveloppes/modifier" replace />,
});
