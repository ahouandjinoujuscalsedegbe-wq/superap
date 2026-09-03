import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { grouperParCategorie, CATEGORIE_LIBRE } from "@/lib/categories";
import { etatEnveloppe } from "@/lib/enveloppe-etat";
import { CarteEnveloppe } from "./enveloppes.details";

export const Route = createFileRoute("/enveloppes/categorie/$nom")({
  head: ({ params }) => {
    const nom = decodeURIComponent(params.nom);
    return {
      meta: [
        { title: `${nom} — Enveloppes de la catégorie en FCFA` },
        {
          name: "description",
          content: `Sous-catégories et enveloppes enregistrées dans la catégorie ${nom}, avec plafonds et restes en francs CFA.`,
        },
        { property: "og:title", content: `${nom} — SUPER APP` },
        {
          property: "og:description",
          content: `Détail des enveloppes de la catégorie ${nom} du budget du foyer.`,
        },
      ],
    };
  },
  component: PageCategorie,
});

function PageCategorie() {
  const { nom } = Route.useParams();
  const categorie = decodeURIComponent(nom);
  const { enveloppes, depensesParEnveloppe } = useSuperApp();
  const [enveloppeOuverte, setEnveloppeOuverte] = useState<string | null>(null);

  const groupe = useMemo(
    () => grouperParCategorie(enveloppes).find((g) => g.categorie === categorie),
    [enveloppes, categorie],
  );

  const totalRestant =
    groupe?.sousCategories.reduce(
      (somme, sous) =>
        somme +
        sous.enveloppes.reduce(
          (s, e) => s + etatEnveloppe(e, depensesParEnveloppe[e.id] ?? 0).restant,
          0,
        ),
      0,
    ) ?? 0;

  return (
    <div className="space-y-5">
      <section className="carte space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold">
            {categorie === CATEGORIE_LIBRE ? "Sans catégorie" : categorie}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatFCFA(totalRestant)} restants dans cette catégorie.
          </p>
        </div>

        {!groupe ? (
          <p className="text-sm text-muted-foreground">
            Aucune enveloppe enregistrée dans cette catégorie.
          </p>
        ) : (
          <div className="space-y-4">
            {groupe.sousCategories.map((sous) => (
              <div key={sous.sousCategorie}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  {sous.sousCategorie}
                </h3>
                <ul className="space-y-3">
                  {sous.enveloppes.map((e) => (
                    <li key={e.id} className="rounded-xl border border-border/70 p-4">
                      <CarteEnveloppe
                        e={e}
                        estOuverte={enveloppeOuverte === e.id}
                        onToggle={() =>
                          setEnveloppeOuverte(enveloppeOuverte === e.id ? null : e.id)
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
