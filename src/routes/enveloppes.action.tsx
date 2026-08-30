import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { X, Plus, Pencil, FolderTree } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";

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

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

function ActionEnveloppes() {
  const { enveloppes, ajouterEnveloppe } = useSuperApp();

  const [modal, setModal] = useState<"creer" | null>(null);

  const [nom, setNom] = useState("");
  const [emoji, setEmoji] = useState("💡");
  const [plafond, setPlafond] = useState("");
  const [dotation, setDotation] = useState("");
  const [categorie, setCategorie] = useState("");
  const [sousCategorie, setSousCategorie] = useState("");

  const [confirmation, setConfirmation] = useState<{
    nom: string;
    emoji: string;
    plafond: number;
    dotation: number;
    categorie: string;
    sousCategorie: string;
  } | null>(null);

  const [erreur, setErreur] = useState<string | null>(null);

  const listeCategories = useSuperApp().categories;
  const categorieChoisie = listeCategories.find((c) => c.nom === categorie.trim());
  const sousCategories = categorieChoisie?.sousCategories ?? [];

  function ouvrirCreer() {
    setNom("");
    setEmoji("💡");
    setPlafond("");
    setDotation("");
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
    const somme = Number(dotation);
    if (!Number.isFinite(somme) || somme <= 0) {
      setErreur("Indiquez la somme attribuée à cette enveloppe (montant placé dedans).");
      return;
    }
    if (somme < valeur) {
      setErreur(
        "Le plafond ne peut pas dépasser la somme attribuée : le plafond est le montant de dépenses à ne pas dépasser.",
      );
      return;
    }
    if (!categorie.trim()) {
      setErreur(
        "La catégorie est obligatoire : choisissez-en une dans la liste déroulante avant de créer l'enveloppe.",
      );
      return;
    }
    if (!categorieChoisie) {
      setErreur(
        `La catégorie « ${categorie.trim()} » n'existe pas. Choisissez une catégorie de la liste ou créez-la depuis « Gérer les catégories et sous-catégories ».`,
      );
      return;
    }
    if (sousCategories.length > 0 && !sousCategorie.trim()) {
      setErreur(
        "Cette catégorie possède des sous-catégories : choisissez-en une avant de créer l'enveloppe.",
      );
      return;
    }
    if (sousCategorie.trim() && !sousCategories.includes(sousCategorie.trim())) {
      setErreur(
        `La sous-catégorie « ${sousCategorie.trim()} » n'existe pas dans la catégorie « ${categorie.trim()} ». Reprenez votre choix.`,
      );
      return;
    }
    setConfirmation({
      nom: nom.trim(),
      emoji: emoji.trim() || "💡",
      plafond: valeur,
      dotation: somme,
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
                Ouvrez la page de création d'enveloppe.
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
        </div>
      </section>

      <ErreurPopup
        ouvert={erreur !== null}
        message={erreur ?? ""}
        onFermer={() => setErreur(null)}
      />

      <Confirmation
        ouvert={confirmation !== null}
        titre="Confirmer la création"
        message="Vérifiez les champs de la nouvelle enveloppe avant de valider."
        details={
          confirmation
            ? [
                { label: "Emoji", apres: confirmation.emoji },
                { label: "Nom", apres: confirmation.nom },
                { label: "Plafond", apres: formatFCFA(confirmation.plafond) },
                { label: "Somme attribuée", apres: formatFCFA(confirmation.dotation) },
                { label: "Catégorie", apres: confirmation.categorie || "Sans catégorie" },
                { label: "Sous-catégorie", apres: confirmation.sousCategorie || "Général" },
              ]
            : []
        }
        confirmerLabel="Créer"
        onConfirmer={confirmerCreation}
        onAnnuler={() => setConfirmation(null)}
      />
    </div>
  );
}
