import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { grouperParCategorie, CATEGORIE_LIBRE } from "@/lib/categories";
import { etatEnveloppe } from "@/lib/enveloppe-etat";

export const Route = createFileRoute("/enveloppes/")({
  head: () => ({
    meta: [
      { title: "Enveloppes — Accueil des enveloppes budgétaires" },
      {
        name: "description",
        content:
          "Tableau de bord des catégories d'enveloppes, budgétisation, actions et chronologie du budget du foyer en FCFA.",
      },
    ],
  }),
  component: EnveloppesAccueil,
});

const liens = [
  {
    to: "/enveloppes/budgetisation",
    titre: "Budgétisation",
    texte: "Planifiez vos dépenses période par période.",
  },
  {
    to: "/enveloppes/action",
    titre: "Action",
    texte: "Ajoutez, modifiez ou supprimez vos enveloppes.",
  },
  {
    to: "/enveloppes/chronologie",
    titre: "Chronologie et suivi",
    texte: "Échéances à venir et prévu contre réel.",
  },
] as const;

function EnveloppesAccueil() {
  const { enveloppes, depensesParEnveloppe } = useSuperApp();
  const groupes = useMemo(() => grouperParCategorie(enveloppes), [enveloppes]);

  return (
    <div className="space-y-4">
      <section className="carte space-y-3 p-4">
        <div>
          <h2 className="text-lg font-semibold">Détails actuels</h2>
          <p className="text-sm text-muted-foreground">
            Les catégories d'enveloppes disponibles. Touchez une catégorie pour voir ses
            sous-catégories et ses enveloppes.
          </p>
        </div>

        {groupes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune enveloppe pour le moment.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {groupes.map((groupe) => {
              const enveloppesCat = groupe.sousCategories.flatMap((s) => s.enveloppes);
              const restant = enveloppesCat.reduce(
                (s, e) => s + etatEnveloppe(e, depensesParEnveloppe[e.id] ?? 0).restant,
                0,
              );
              return (
                <li key={groupe.categorie}>
                  <Link
                    to="/enveloppes/categorie/$nom"
                    params={{ nom: encodeURIComponent(groupe.categorie) }}
                    className="flex h-full flex-col justify-between rounded-xl border border-border/70 bg-secondary/40 p-3 transition-colors hover:bg-secondary"
                  >
                    <span className="text-sm font-semibold leading-tight">
                      {groupe.categorie === CATEGORIE_LIBRE ? "Sans catégorie" : groupe.categorie}
                    </span>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {enveloppesCat.length} enveloppe{enveloppesCat.length > 1 ? "s" : ""}
                    </span>
                    <span className="mt-0.5 block text-xs font-medium text-foreground">
                      {formatFCFA(restant)} restants
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ul className="grid gap-3">
        {liens.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="carte block p-4 transition-colors hover:bg-accent/40">
              <p className="font-semibold">{l.titre}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{l.texte}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
