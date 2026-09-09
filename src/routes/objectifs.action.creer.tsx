import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AssistantObjectif } from "@/components/AssistantObjectif";

export const Route = createFileRoute("/objectifs/action/creer")({
  head: () => ({
    meta: [
      { title: "Créer un objectif — SUPER APP" },
      {
        name: "description",
        content:
          "Assistant pas à pas pour créer une épargne, un achat programmé ou une tontine avec tous les détails.",
      },
      { property: "og:title", content: "Créer un objectif — SUPER APP" },
      {
        property: "og:description",
        content: "Répondez aux questions et votre objectif est créé avec ses rappels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreerObjectif,
});

function CreerObjectif() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4 p-4 pb-28">
      <div>
        <h1 className="text-lg font-semibold">Créer un nouvel objectif</h1>
        <p className="text-sm text-muted-foreground">
          Répondez aux questions étape par étape. Vous relisez tout avant d'enregistrer.
        </p>
      </div>
      <AssistantObjectif onTermine={() => navigate({ to: "/objectifs/action" })} />
    </div>
  );
}
