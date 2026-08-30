import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/comptes/transferts")({
  component: () => <Outlet />,
});
