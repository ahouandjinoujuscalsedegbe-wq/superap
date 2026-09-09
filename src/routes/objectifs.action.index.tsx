import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Pencil, Plus } from "lucide-react";

import { useSuperApp } from "@/lib/store";

export const Route = createFileRoute("/objectifs/action/")({
  head: () => ({
    meta: [
      { title: "Action sur un objectif — SUPER APP" },
      {
        name: "description",
        content:
          "Créer, modifier, clôturer ou supprimer un objectif d'épargne, d'achat programmé ou de tontine.",
      },
      { property: "og:title", content: "Action sur un objectif — SUPER APP" },
      {
        property: "og:description",
        content: "Toutes les opérations possibles sur vos objectifs, en un seul endroit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MenuActionObjectifs,
});

function MenuActionObjectifs() {
  const { objectifs } = useSuperApp();

  return (
    <div className="space-y-4 p-4 pb-28">
      <h1 className="text-lg font-semibold">Action sur un objectif</h1>
      <p className="text-sm text-muted-foreground">
        Choisissez ce que vous voulez faire : créer un nouvel objectif, ou agir sur un objectif
        existant.
      </p>

      <Link
        to="/objectifs/action/creer"
        className="carte flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Plus className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Créer un nouvel objectif</span>
          <span className="block text-xs text-muted-foreground">
            Épargne, achat programmé ou tontine : vous répondez aux questions une par une.
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>

      <Link
        to="/objectifs/action/gerer"
        className="carte flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Pencil className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Modifier, clôturer ou supprimer</span>
          <span className="block text-xs text-muted-foreground">
            {objectifs.length === 0
              ? "Aucun objectif enregistré pour le moment."
              : `${objectifs.length} objectif${objectifs.length > 1 ? "s" : ""} à gérer.`}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}
