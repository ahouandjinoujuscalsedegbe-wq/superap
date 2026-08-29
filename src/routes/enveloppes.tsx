import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/enveloppes")({
  head: () => ({
    meta: [
      { title: "Enveloppes — Budgétisation et gestion en FCFA" },
      {
        name: "description",
        content:
          "Répartissez le budget du foyer en enveloppes, planifiez vos dépenses par période et modifiez vos enveloppes en francs CFA.",
      },
      { property: "og:title", content: "Enveloppes — SUPER APP" },
      {
        property: "og:description",
        content: "Enveloppes, budgétisation par période et gestion des plafonds en FCFA.",
      },
    ],
  }),
  component: EnveloppesLayout,
});

function EnveloppesLayout() {
  const { enveloppes, depensesParEnveloppe } = useSuperApp();

  const totalPlafond = enveloppes.reduce((s, e) => s + e.plafond, 0);
  const totalUtilise = enveloppes.reduce((s, e) => s + (depensesParEnveloppe[e.id] ?? 0), 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Enveloppes</h1>
        <p className="text-sm text-muted-foreground">
          {formatFCFA(totalUtilise)} utilisés sur {formatFCFA(totalPlafond)}
        </p>
      </header>

      <Outlet />
    </div>
  );
}
