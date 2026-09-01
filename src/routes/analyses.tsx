import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Les analyses ont fusionné avec « Mon conseiller » : elles sont désormais
 * un onglet du tableau de bord du conseiller. Cette route reste pour les
 * anciens liens.
 */
export const Route = createFileRoute("/analyses")({
  beforeLoad: () => {
    throw redirect({ to: "/notifications" });
  },
  component: () => null,
});
