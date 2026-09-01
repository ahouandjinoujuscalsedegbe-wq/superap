import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * L'assistant a fusionné avec « Mon conseiller » : toutes ses fonctions
 * (questions libres, périodes, enveloppes, dettes, moyennes, répartition)
 * sont désormais servies par le coach. Cette route reste pour les anciens
 * liens et renvoie vers la page unique.
 */
export const Route = createFileRoute("/assistant")({
  beforeLoad: () => {
    throw redirect({ to: "/notifications" });
  },
  component: () => null,
});
