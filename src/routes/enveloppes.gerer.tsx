import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Pencil } from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";

export const Route = createFileRoute("/enveloppes/gerer")({
  head: () => ({
    meta: [
      { title: "Gérer les enveloppes — SUPER APP" },
      {
        name: "description",
        content:
          "Créez une nouvelle enveloppe budgétaire ou modifiez une enveloppe existante.",
      },
      { property: "og:title", content: "Gérer les enveloppes — SUPER APP" },
      {
        property: "og:description",
        content:
          "Création et modification des enveloppes budgétaires en FCFA.",
      },
    ],
  }),
  component: GererEnveloppes,
});

function GererEnveloppes() {
  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/action" label="Retour aux actions" />
      <section className="carte space-y-4 p-4">
        <h2 className="text-lg font-semibold">Gérer les enveloppes</h2>

        <div className="space-y-3">
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
                Ajoutez une enveloppe avec son plafond et sa catégorie.
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
                Renommez, changez le plafond ou supprimez une enveloppe.
              </p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
