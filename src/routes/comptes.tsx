import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/comptes")({
  head: () => ({
    meta: [
      { title: "Comptes — Soldes, actions et transferts en FCFA" },
      {
        name: "description",
        content:
          "Consultez le solde de chaque compte du foyer, ajoutez ou modifiez vos comptes et effectuez des transferts en francs CFA.",
      },
      { property: "og:title", content: "Comptes — SUPER APP" },
      {
        property: "og:description",
        content: "Soldes par compte, gestion des comptes et transferts internes en FCFA.",
      },
    ],
  }),
  component: ComptesLayout,
});

function ComptesLayout() {
  const { comptes, soldesParCompte } = useSuperApp();
  const total = comptes.reduce((s, c) => s + (soldesParCompte[c] ?? 0), 0);

  return (
    <div className="space-y-5">
      <header className="pr-12">
        <h1 className="text-2xl font-bold tracking-tight">Comptes</h1>
        <p className="text-sm text-muted-foreground">
          {formatFCFA(total)} disponibles sur {comptes.length} compte
          {comptes.length > 1 ? "s" : ""}
        </p>
      </header>

      <Outlet />
    </div>
  );
}
