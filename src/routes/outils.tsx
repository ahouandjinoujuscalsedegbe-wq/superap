import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Les outils et simulations ont fusionné avec « Mon conseiller » : ils sont
 * désormais un onglet du tableau de bord du conseiller. Cette route reste
 * pour les anciens liens.
 */
export const Route = createFileRoute("/outils")({
  beforeLoad: () => {
    throw redirect({ to: "/notifications" });
  },
  component: () => null,
});
