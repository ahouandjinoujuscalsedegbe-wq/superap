import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Settings, Wallet } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatDateFr, formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accueil — SUPER APP, budget du foyer en FCFA" },
      {
        name: "description",
        content:
          "Suivez le solde du foyer, les revenus et les dépenses du mois en francs CFA, hors ligne et en français.",
      },
      { property: "og:title", content: "Accueil — SUPER APP" },
      {
        property: "og:description",
        content: "Solde du foyer, revenus et dépenses du mois en francs CFA.",
      },
    ],
  }),
  component: Accueil,
});

function Accueil() {
  const { solde, totalRevenus, totalDepenses, transactions } = useSuperApp();
  const dernieres = transactions.slice(0, 8);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Bonjour 👋</p>
          <h1 className="text-2xl font-bold tracking-tight">Budget du foyer</h1>
        </div>
        <Link
          to="/parametres"
          aria-label="Paramètres"
          className="surface rounded-full border border-border p-2.5 text-muted-foreground"
        >
          <Settings className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      <section className="carte p-5">
        <p className="text-sm text-muted-foreground">Solde disponible</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-primary">
          {formatFCFA(solde)}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-secondary/70 p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowUpRight className="h-4 w-4 text-success" aria-hidden /> Revenus
            </span>
            <p className="mt-1 font-semibold">{formatFCFA(totalRevenus)}</p>
          </div>
          <div className="rounded-xl bg-secondary/70 p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowDownRight className="h-4 w-4 text-destructive" aria-hidden /> Dépenses
            </span>
            <p className="mt-1 font-semibold">{formatFCFA(totalDepenses)}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link
          to="/revenu"
          className="carte flex flex-col gap-1 p-4 text-left transition-transform active:scale-[0.98]"
        >
          <ArrowUpRight className="h-5 w-5 text-success" aria-hidden />
          <span className="font-semibold">Ajouter un revenu</span>
          <span className="text-xs text-muted-foreground">Salaire, activité, aide…</span>
        </Link>
        <Link
          to="/depense"
          className="carte flex flex-col gap-1 p-4 text-left transition-transform active:scale-[0.98]"
        >
          <ArrowDownRight className="h-5 w-5 text-destructive" aria-hidden />
          <span className="font-semibold">Ajouter une dépense</span>
          <span className="text-xs text-muted-foreground">En 2 secondes</span>
        </Link>
      </section>

      <section className="carte p-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Dernières opérations
        </h2>
        {dernieres.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Wallet className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Aucune opération enregistrée pour le moment.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {dernieres.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.libelle}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.compte} · {formatDateFr(t.date)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    t.type === "revenu" ? "text-success" : "text-destructive"
                  }`}
                >
                  {t.type === "revenu" ? "+" : "−"} {formatFCFA(t.montant)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
