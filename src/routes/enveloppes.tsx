import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const totalPlafond = enveloppes.reduce((s, e) => s + e.plafond, 0);
  const totalUtilise = enveloppes.reduce((s, e) => s + (depensesParEnveloppe[e.id] ?? 0), 0);

  const onglets = [
    { to: "/enveloppes/budgetisation", label: "Budgétisation" },
    { to: "/enveloppes/action", label: "Action" },
    { to: "/enveloppes/details", label: "Détails actuels" },
    { to: "/enveloppes/chronologie", label: "Chronologie et suivi" },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {onglets.map((o) => {
          const actif = pathname === o.to;
          return (
            <Link
              key={o.to}
              to={o.to}
              aria-current={actif ? "page" : undefined}
              className={`flex items-center justify-center rounded-xl px-1 py-2.5 text-center text-[11px] font-semibold leading-tight transition-colors sm:text-xs ${
                actif
                  ? "bg-primary text-primary-foreground shadow"
                  : "border border-input bg-card text-foreground"
              }`}
            >
              {o.label}
            </Link>
          );
        })}
      </div>

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
