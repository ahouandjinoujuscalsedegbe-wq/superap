import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Pencil, FolderTree, RefreshCcw } from "lucide-react";
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

          <Link
            to="/enveloppes/creer"
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Plus aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Créer une nouvelle enveloppe</p>
              <p className="text-sm text-muted-foreground">
                Ouvrez la page dédiée à la création d'enveloppe.
              </p>
            </div>
          </Link>

          <Link
            to="/enveloppes/modifier"
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Pencil aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Modifier une enveloppe existante</p>
              <p className="text-sm text-muted-foreground">
                Renommez, changez le plafond ou supprimez.
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
        </div>
      </section>
    </div>
  );
}
