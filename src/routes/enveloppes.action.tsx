import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Pencil, FolderTree, RefreshCcw, Scale, LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/enveloppes/action")({
  head: () => ({
    meta: [
      { title: "Action — Gérer les enveloppes budgétaires" },
      {
        name: "description",
        content:
          "Ajoutez, modifiez ou supprimez les enveloppes budgétaires du foyer et leurs plafonds en francs CFA.",
      },
      { property: "og:title", content: "Action — SUPER APP" },
      {
        property: "og:description",
        content:
          "Gestion des enveloppes : création, modification des plafonds et suppression en FCFA.",
      },
    ],
  }),
  component: ActionEnveloppes,
});

function ActionEnveloppes() {
  return (
    <div className="space-y-5">
      <section className="carte space-y-4 p-4">
        <h2 className="text-lg font-semibold">Action</h2>

        <div className="space-y-3">
          <Link
            to="/enveloppes/categories"
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FolderTree aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Gérer les catégories et sous-catégories</p>
              <p className="text-sm text-muted-foreground">
                Créez, renommez ou supprimez vos classements.
              </p>
            </div>
          </Link>

          <Link
            to="/enveloppes/modifier"
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FolderTree aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Gérer les enveloppes</p>
              <p className="text-sm text-muted-foreground">
                Créer ou modifier une enveloppe existante.
              </p>
            </div>
          </Link>
          <Link
            to="/enveloppes/renouvellements"
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <RefreshCcw aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Détail des renouvellements</p>
              <p className="text-sm text-muted-foreground">
                Période, montant débité, compte source et part de revenu.
              </p>
            </div>
          </Link>
          <Link
            to="/enveloppes/budgetisation"
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Scale aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Budget : plan, suivi et proposition</p>
              <p className="text-sm text-muted-foreground">
                Une seule page : dépenses planifiées, comparaison au réel, budget auto.
              </p>
            </div>
          </Link>

          <Link
            to="/enveloppes/secours"
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <LifeBuoy aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Plan de secours (enveloppe épuisée)</p>
              <p className="text-sm text-muted-foreground">
                Analyse, explications et transferts sûrs depuis d'autres enveloppes.
              </p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
