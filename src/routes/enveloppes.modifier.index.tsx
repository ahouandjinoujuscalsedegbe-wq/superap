import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { grouperParCategorie } from "@/lib/categories";
import { etatEnveloppe } from "@/lib/enveloppe-etat";
import { CarteEnveloppe } from "./enveloppes.details";

export const Route = createFileRoute("/enveloppes/modifier/")({
  head: () => ({
    meta: [
      { title: "Modifier une enveloppe — SUPER APP" },
      {
        name: "description",
        content:
          "Liste des enveloppes budgétaires existantes : ouvrez une enveloppe pour la modifier ou la supprimer sur sa propre page.",
      },
      { property: "og:title", content: "Modifier une enveloppe — SUPER APP" },
      {
        property: "og:description",
        content:
          "Choisissez l'enveloppe à modifier : chaque modification se fait sur une page dédiée, avec logos proposés et confirmation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ListeModification,
});

function ListeModification() {
  const { enveloppes, depensesParEnveloppe } = useSuperApp();
  const [detail, setDetail] = useState<string | null>(null);
  const [operations, setOperations] = useState<string | null>(null);
  const groupes = grouperParCategorie(enveloppes);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Modifier une enveloppe existante</h1>
        <p className="text-sm text-muted-foreground">
          {enveloppes.length} enveloppe{enveloppes.length > 1 ? "s" : ""} · touchez le crayon pour
          ouvrir la page de modification.
        </p>
      </header>

      {enveloppes.length === 0 ? (
        <p className="carte p-4 text-sm text-muted-foreground">Aucune enveloppe à modifier.</p>
      ) : (
        <div className="space-y-5">
          {groupes.map((g) => (
            <section key={g.categorie} className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
                {g.categorie}
              </h2>
              {g.sousCategories.map((s) => (
                <div key={s.sousCategorie} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {s.sousCategorie}
                  </p>
                  <ul className="space-y-3">
                    {s.enveloppes.map((e) => {
                      const etat = etatEnveloppe(e, depensesParEnveloppe[e.id] ?? 0);
                      const pourcentage = etat.pourcentage;
                      const couleurBarre = etat.plafondAtteint
                        ? "bg-destructive"
                        : pourcentage >= 80
                          ? "bg-amber-500"
                          : "bg-success";
                      return (
                        <li key={e.id} className="carte p-4">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setDetail(detail === e.id ? null : e.id)}
                              aria-expanded={detail === e.id}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <ChevronDown
                                aria-hidden
                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
                                  detail === e.id ? "rotate-180" : ""
                                }`}
                              />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold">
                                  <span aria-hidden>{e.emoji}</span> {e.nom}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {formatFCFA(etat.restant)} restants · plafond{" "}
                                  {formatFCFA(e.plafond)}
                                </span>
                              </span>
                            </button>
                            <Link
                              to="/enveloppes/modifier/$id"
                              params={{ id: e.id }}
                              aria-label={`Modifier l'enveloppe ${e.nom}`}
                              title="Modifier"
                              className="flex shrink-0 items-center justify-center rounded-lg border border-input p-2 text-xs font-medium"
                            >
                              <Pencil aria-hidden className="h-4 w-4" />
                            </Link>
                          </div>

                          <div
                            className="mt-2 h-2.5 w-full overflow-hidden rounded-full border border-border/40 bg-secondary"
                            role="progressbar"
                            aria-valuenow={Math.round(pourcentage)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Consommation du plafond de l'enveloppe ${e.nom} : ${Math.round(pourcentage)} %`}
                          >
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${couleurBarre}`}
                              style={{ width: `${pourcentage}%` }}
                            />
                          </div>

                          {detail === e.id && (
                            <div className="mt-3 border-t border-border/70 pt-3">
                              <CarteEnveloppe
                                e={e}
                                estOuverte={operations === e.id}
                                onToggle={() => setOperations(operations === e.id ? null : e.id)}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
