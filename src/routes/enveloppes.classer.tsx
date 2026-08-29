import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { CATEGORIE_LIBRE, grouperParCategorie } from "@/lib/categories";

export const Route = createFileRoute("/enveloppes/classer")({
  head: () => ({
    meta: [
      { title: "Catégoriser les enveloppes existantes — SUPER APP" },
      {
        name: "description",
        content:
          "Attribuez une catégorie et une sous-catégorie à chaque enveloppe existante et réordonnez-les à l'intérieur d'une catégorie.",
      },
      { property: "og:title", content: "Catégoriser les enveloppes — SUPER APP" },
      {
        property: "og:description",
        content: "Classement et ordre personnalisé des enveloppes budgétaires du foyer.",
      },
    ],
  }),
  component: ClasserEnveloppes,
});

const champ =
  "mt-1 w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

type Demande = {
  id: string;
  nom: string;
  ancienneCategorie: string;
  ancienneSous: string;
  categorie: string;
  sousCategorie: string;
} | null;

function ClasserEnveloppes() {
  const { enveloppes, categories, modifierEnveloppe, deplacerEnveloppe } = useSuperApp();
  const [demande, setDemande] = useState<Demande>(null);

  const groupes = grouperParCategorie(enveloppes);

  function changer(id: string, categorie: string, sousCategorie: string) {
    const e = enveloppes.find((x) => x.id === id);
    if (!e) return;
    setDemande({
      id,
      nom: e.nom,
      ancienneCategorie: e.categorie ?? "",
      ancienneSous: e.sousCategorie ?? "",
      categorie,
      sousCategorie,
    });
  }

  function confirmer() {
    if (!demande) return;
    modifierEnveloppe(demande.id, {
      categorie: demande.categorie,
      sousCategorie: demande.sousCategorie,
    });
    setDemande(null);
    toast.success("Classement mis à jour.");
  }

  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/action" label="Retour à Action" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Catégoriser les enveloppes existantes</h1>
        <p className="text-sm text-muted-foreground">
          Choisissez la catégorie de chaque enveloppe et ajustez leur ordre avec les flèches. L'ordre est conservé.
        </p>
      </header>

      {groupes.map((g) => (
        <section key={g.categorie} className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary">{g.categorie}</h2>
          {g.sousCategories.map((s) =>
            s.enveloppes.map((e) => {
              const cat = categories.find((c) => c.nom === (e.categorie ?? ""));
              return (
                <div key={e.id} className="carte space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-semibold">
                      <span aria-hidden>{e.emoji}</span> {e.nom}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-sm text-muted-foreground">{formatFCFA(e.plafond)}</span>
                      <button
                        type="button"
                        aria-label={`Monter ${e.nom}`}
                        onClick={() => deplacerEnveloppe(e.id, "haut")}
                        className="rounded-full p-2 hover:bg-secondary"
                      >
                        <ArrowUp aria-hidden className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Descendre ${e.nom}`}
                        onClick={() => deplacerEnveloppe(e.id, "bas")}
                        className="rounded-full p-2 hover:bg-secondary"
                      >
                        <ArrowDown aria-hidden className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`cat-${e.id}`} className="text-xs font-medium text-muted-foreground">
                        Catégorie
                      </label>
                      <select
                        id={`cat-${e.id}`}
                        value={e.categorie ?? ""}
                        onChange={(ev) => changer(e.id, ev.target.value, "")}
                        className={champ}
                      >
                        <option value="">{CATEGORIE_LIBRE}</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.nom}>
                            {c.nom}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`sous-${e.id}`} className="text-xs font-medium text-muted-foreground">
                        Sous-catégorie
                      </label>
                      <select
                        id={`sous-${e.id}`}
                        value={e.sousCategorie ?? ""}
                        onChange={(ev) => changer(e.id, e.categorie ?? "", ev.target.value)}
                        disabled={!cat}
                        className={champ}
                      >
                        <option value="">Général</option>
                        {(cat?.sousCategories ?? []).map((sc) => (
                          <option key={sc} value={sc}>
                            {sc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="sr-only">{s.sousCategorie}</p>
                </div>
              );
            }),
          )}
        </section>
      ))}

      <Confirmation
        ouvert={demande !== null}
        titre="Modifier le classement ?"
        message="Vérifiez le nouveau classement de cette enveloppe."
        details={
          demande
            ? [
                { label: "Enveloppe", apres: demande.nom },
                {
                  label: "Catégorie",
                  avant: demande.ancienneCategorie || CATEGORIE_LIBRE,
                  apres: demande.categorie || CATEGORIE_LIBRE,
                },
                {
                  label: "Sous-catégorie",
                  avant: demande.ancienneSous || "Général",
                  apres: demande.sousCategorie || "Général",
                },
              ]
            : []
        }
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
