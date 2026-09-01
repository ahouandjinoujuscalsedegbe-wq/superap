import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Pencil, FolderTree, RefreshCcw, Scale, LifeBuoy } from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";

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
      <BoutonRetour to="/enveloppes/" label="Retour aux enveloppes" />
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

          <div className="carte space-y-3 p-4">
            <p className="font-semibold">Gérer les enveloppes</p>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/enveloppes/creer"
                className="carte flex flex-col items-start gap-2 p-3 text-left transition-colors hover:bg-accent/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Plus aria-hidden className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Créer</p>
                  <p className="text-xs text-muted-foreground">
                    Nouvelle enveloppe.
                  </p>
                </div>
              </Link>

              <Link
                to="/enveloppes/modifier"
                className="carte flex flex-col items-start gap-2 p-3 text-left transition-colors hover:bg-accent/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Pencil aria-hidden className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Modifier</p>
                  <p className="text-xs text-muted-foreground">
                    Renommer, plafond, supprimer.
                  </p>
                </div>
              </Link>
            </div>
          </div>
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
            to="/enveloppes/budget-mensuel"
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Scale aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Budget mensuel et dépenses réelles</p>
              <p className="text-sm text-muted-foreground">
                Budget calculé seul depuis la période, comparé au réel.
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
