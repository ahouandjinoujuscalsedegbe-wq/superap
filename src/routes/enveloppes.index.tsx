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


/** Adapte la densité des cases au nombre de catégories affichées. */
function grilleDynamique(nombre: number) {
  if (nombre === 1) {
    return {
      grille: "grid-cols-1",
      padding: "p-3",
      nom: "text-sm",
      info: "text-xs",
      montant: "text-sm",
      hauteur: "min-h-[4.5rem]",
    };
  }
  if (nombre === 2) {
    return {
      grille: "grid-cols-2",
      padding: "p-2.5",
      nom: "text-xs",
      info: "text-[10px]",
      montant: "text-xs",
      hauteur: "min-h-[4rem]",
    };
  }
  if (nombre === 3) {
    return {
      grille: "grid-cols-3",
      padding: "p-2",
      nom: "text-[11px]",
      info: "text-[9px]",
      montant: "text-[11px]",
      hauteur: "min-h-[3.75rem]",
    };
  }
  if (nombre <= 5) {
    return {
      grille: "grid-cols-2",
      padding: "p-2",
      nom: "text-[11px]",
      info: "text-[9px]",
      montant: "text-[11px]",
      hauteur: "min-h-[3.5rem]",
    };
  }
  return {
    grille: "grid-cols-3",
    padding: "p-1.5",
    nom: "text-[10px]",
    info: "text-[8px]",
    montant: "text-[10px]",
    hauteur: "min-h-[3.25rem]",
  };
}

function EnveloppesAccueil() {
  const { enveloppes, depensesParEnveloppe } = useSuperApp();
  const groupes = useMemo(() => grouperParCategorie(enveloppes), [enveloppes]);
  const style = grilleDynamique(groupes.length);

  return (
    <div className="page-anim space-y-4">
      <section className={`carte space-y-2 ${groupes.length >= 6 ? "p-2" : "p-3"}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Détails actuels</h2>
          <span className="text-xs text-muted-foreground">
            {groupes.length} catégorie{groupes.length > 1 ? "s" : ""}
          </span>
        </div>

        {groupes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune enveloppe pour le moment.</p>
        ) : (
          <ul className={`grid gap-1.5 ${style.grille}`}>
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
                    className={`flex h-full flex-col justify-between rounded-lg border border-border/70 bg-secondary/40 ${style.padding} ${style.hauteur} transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary active:scale-[0.99]`}
                  >
                    <span className={`truncate font-semibold leading-tight ${style.nom}`}>
                      {groupe.categorie === CATEGORIE_LIBRE ? "Sans catégorie" : groupe.categorie}
                    </span>
                    <span className="mt-1 space-y-0">
                      <span className={`block leading-none text-muted-foreground ${style.info}`}>
                        {enveloppesCat.length} env.
                      </span>
                      <span className={`mt-0.5 block font-bold leading-none ${style.montant}`}>
                        {formatFCFA(restant)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </div>
  );
}
