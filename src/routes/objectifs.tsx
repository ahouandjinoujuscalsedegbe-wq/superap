import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Disposition parente des pages Objectifs : la page consultée s'affiche ici. */
export const Route = createFileRoute("/objectifs")({
  component: () => <Outlet />,
});
