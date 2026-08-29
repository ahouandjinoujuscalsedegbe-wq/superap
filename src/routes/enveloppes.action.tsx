import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { X, Plus, Pencil } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";

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
        content: "Gestion des enveloppes : création, modification des plafonds et suppression en FCFA.",
      },
    ],
  }),
  component: ActionEnveloppes,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

function ActionEnveloppes() {
  const { enveloppes, ajouterEnveloppe } = useSuperApp();

  const [modal, setModal] = useState<"creer" | null>(null);

  const [nom, setNom] = useState("");
  const [emoji, setEmoji] = useState("💡");
  const [plafond, setPlafond] = useState("");
  const [categorie, setCategorie] = useState("");
  const [sousCategorie, setSousCategorie] = useState("");

  const [confirmation, setConfirmation] = useState<{
    nom: string;
    emoji: string;
    plafond: number;
    categorie: string;
    sousCategorie: string;
  } | null>(null);

  const categories = categoriesDisponibles(enveloppes);
  const sousCategories = sousCategoriesDisponibles(enveloppes, categorie.trim());
  const groupes = grouperParCategorie(enveloppes);

  function ouvrirCreer() {
    setNom("");
    setEmoji("💡");
    setPlafond("");
    setCategorie("");
    setSousCategorie("");
    setModal("creer");
  }

  function fermer() {
    setModal(null);
  }

  function creerEnveloppe(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = Number(plafond);
    if (!nom.trim()) {
      toast.error("Donnez un nom à l'enveloppe.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur < 0) {
      toast.error("Plafond invalide.");
      return;
    }
    if (sousCategorie.trim() && !categorie.trim()) {
      toast.error("Choisissez d'abord une catégorie.");
      return;
    }
    setConfirmation({
      nom: nom.trim(),
      emoji: emoji.trim() || "💡",
      plafond: valeur,
      categorie: categorie.trim(),
      sousCategorie: sousCategorie.trim(),
    });
  }

  function confirmerCreation() {
    if (!confirmation) return;
    ajouterEnveloppe(confirmation);
    setConfirmation(null);
    fermer();
    toast.success("Enveloppe ajoutée.");
  }

  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/" label="Retour aux enveloppes" />
      <section className="carte space-y-4 p-4">
        <h2 className="text-lg font-semibold">Action</h2>

        <div className="space-y-3">
          <button
            type="button"
            onClick={ouvrirCreer}
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Plus aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Créer une nouvelle enveloppe</p>
              <p className="text-sm text-muted-foreground">Ajoutez une enveloppe avec son plafond.</p>
            </div>
          </button>

          <Link
            to="/enveloppes/modifier"
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Pencil aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Modifier une enveloppe existante</p>
              <p className="text-sm text-muted-foreground">Renommez, changez le plafond ou supprimez.</p>
            </div>
          </Link>
        </div>
      </section>

      {modal === "creer" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Créer une nouvelle enveloppe"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={fermer}
        >
          <div
            className="carte w-full max-w-md space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Nouvelle enveloppe</h3>
                <p className="text-xs text-muted-foreground">Créez une enveloppe budgétaire.</p>
              </div>
              <button
                type="button"
                onClick={fermer}
                aria-label="Fermer"
                className="rounded-full p-1.5 transition-colors hover:bg-secondary"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={creerEnveloppe} className="space-y-3">
              <div className="flex gap-2">
                <div className="w-20">
                  <label htmlFor="e-emoji" className="text-sm font-medium">
                    Emoji
                  </label>
                  <input
                    id="e-emoji"
                    value={emoji}
                    onChange={(ev) => setEmoji(ev.target.value)}
                    className={champ}
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="e-nom" className="text-sm font-medium">
                    Nom
                  </label>
                  <input
                    id="e-nom"
                    value={nom}
                    onChange={(ev) => setNom(ev.target.value)}
                    placeholder="Santé"
                    className={champ}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="e-plafond" className="text-sm font-medium">
                  Plafond (FCFA)
                </label>
                <input
                  id="e-plafond"
                  inputMode="numeric"
                  value={plafond}
                  onChange={(ev) => setPlafond(ev.target.value.replace(/[^\d]/g, ""))}
                  placeholder="25000"
                  className={champ}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
                >
                  Ajouter
                </button>
                <button
                  type="button"
                  onClick={fermer}
                  className="flex-1 rounded-xl border border-input py-3 font-medium"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Confirmation
        ouvert={confirmation !== null}
        titre="Confirmer la création"
        message={
          confirmation
            ? `Créer l'enveloppe « ${confirmation.nom} » avec un plafond de ${formatFCFA(confirmation.plafond)} ?`
            : ""
        }
        confirmerLabel="Créer"
        onConfirmer={confirmerCreation}
        onAnnuler={() => setConfirmation(null)}
      />
    </div>
  );
}
