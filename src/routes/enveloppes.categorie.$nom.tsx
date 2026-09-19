import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
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
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-hidden />
                  {sous.sousCategorie}
                </h3>
                <ul className="space-y-2">
                  {sous.enveloppes.map((e) => {
                    const etat = etatEnveloppe(e, depensesParEnveloppe[e.id] ?? 0);
                    const ouverte = enveloppeOuverte === e.id;
                    return (
                      <li key={e.id} className="overflow-hidden rounded-xl border border-border/70">
                        <button
                          type="button"
                          onClick={() => setEnveloppeOuverte(ouverte ? null : e.id)}
                          aria-expanded={ouverte}
                          className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left transition-colors hover:bg-secondary/40"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span aria-hidden className="shrink-0 text-lg">
                              {e.emoji}
                            </span>
                            <span className="truncate text-sm font-semibold">{e.nom}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                etat.plafondAtteint
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-success/15 text-success"
                              }`}
                            >
                              {formatFCFA(etat.restant)}
                            </span>
                            <ChevronDown
                              aria-hidden
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
                                ouverte ? "rotate-180" : ""
                              }`}
                            />
                          </span>
                        </button>
                        {ouverte && (
                          <div className="border-t border-border/70 bg-secondary/20 p-4">
                            <CarteEnveloppe
                              e={e}
                              estOuverte
                              onToggle={() => {}}
                              sansBoutonDetails
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
