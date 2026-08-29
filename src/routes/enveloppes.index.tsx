import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/enveloppes/")({
  head: () => ({
    meta: [
      { title: "Enveloppes — Accueil des enveloppes budgétaires" },
      {
        name: "description",
        content:
          "Accédez à la budgétisation, aux actions sur les enveloppes, aux détails actuels et à la chronologie du budget du foyer en FCFA.",
      },
    ],
  }),
  component: EnveloppesAccueil,
});

const liens = [
  { to: "/enveloppes/budgetisation", titre: "Budgétisation", texte: "Planifiez vos dépenses période par période." },
  { to: "/enveloppes/action", titre: "Action", texte: "Ajoutez, modifiez ou supprimez vos enveloppes." },
  { to: "/enveloppes/details", titre: "Détails actuels", texte: "Paramètres, contenu et reste de chaque enveloppe." },
  { to: "/enveloppes/chronologie", titre: "Chronologie et suivi", texte: "Échéances à venir et prévu contre réel." },
] as const;

function EnveloppesAccueil() {
  const { enveloppes, depensesParEnveloppe } = useSuperApp();
  const totalPlafond = enveloppes.reduce((s, e) => s + e.plafond, 0);
  const totalUtilise = enveloppes.reduce((s, e) => s + (depensesParEnveloppe[e.id] ?? 0), 0);

  return (
    <div className="space-y-4">
      <section className="carte space-y-3 p-4">
        <h2 className="text-lg font-semibold">Vue d'ensemble</h2>
        <p className="text-sm text-muted-foreground">
          {enveloppes.length} enveloppe{enveloppes.length > 1 ? "s" : ""} ·{" "}
          {formatFCFA(Math.max(0, totalPlafond - totalUtilise))} restants sur{" "}
          {formatFCFA(totalPlafond)}.
        </p>
      </section>

      <ul className="grid gap-3">
        {liens.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="carte block p-4 transition-colors hover:bg-accent/40"
            >
              <p className="font-semibold">{l.titre}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{l.texte}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
