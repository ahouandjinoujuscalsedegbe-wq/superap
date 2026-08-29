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

  const [erreur, setErreur] = useState<string | null>(null);

  const listeCategories = useSuperApp().categories;
  const categorieChoisie = listeCategories.find((c) => c.nom === categorie.trim());
  const sousCategories = categorieChoisie?.sousCategories ?? [];

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
    if (!categorie.trim()) {
      setErreur("La catégorie est obligatoire : choisissez-en une dans la liste déroulante avant de créer l'enveloppe.");
      return;
    }
    if (!categorieChoisie) {
      setErreur(`La catégorie « ${categorie.trim()} » n'existe pas. Choisissez une catégorie de la liste ou créez-la depuis « Gérer les catégories et sous-catégories ».`);
      return;
    }
    if (sousCategories.length > 0 && !sousCategorie.trim()) {
      setErreur("Cette catégorie possède des sous-catégories : choisissez-en une avant de créer l'enveloppe.");
      return;
    }
    if (sousCategorie.trim() && !sousCategories.includes(sousCategorie.trim())) {
      setErreur(`La sous-catégorie « ${sousCategorie.trim()} » n'existe pas dans la catégorie « ${categorie.trim()} ». Reprenez votre choix.`);
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
          <Link
            to="/enveloppes/categories"
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FolderTree aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Gérer les catégories et sous-catégories</p>
              <p className="text-sm text-muted-foreground">Créez, renommez ou supprimez vos classements.</p>
            </div>
          </Link>

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

              <div>
                <label htmlFor="e-categorie" className="text-sm font-medium">
                  Catégorie (obligatoire)
                </label>
                <select
                  id="e-categorie"
                  value={categorie}
                  onChange={(ev) => {
                    const valeur = ev.target.value;
                    if (valeur && !listeCategories.some((c) => c.nom === valeur)) {
                      setErreur(
                        `La catégorie « ${valeur} » n'existe pas dans la liste. Choisissez une catégorie proposée ou créez-la depuis « Gérer les catégories et sous-catégories ».`
                      );
                      ev.target.value = categorie;
                      return;
                    }
                    setCategorie(valeur);
                    setSousCategorie("");
                  }}
                  className={champ}
                >
                  <option value="">Choisir une catégorie…</option>
                  {listeCategories.map((c) => (
                    <option key={c.id} value={c.nom}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="e-sous-categorie" className="text-sm font-medium">
                  Sous-catégorie{sousCategories.length > 0 ? " (obligatoire)" : ""}
                </label>
                <select
                  id="e-sous-categorie"
                  value={sousCategorie}
                  onChange={(ev) => {
                    const valeur = ev.target.value;
                    if (valeur && !sousCategories.includes(valeur)) {
                      setErreur(
                        `La sous-catégorie « ${valeur} » n'existe pas dans la catégorie « ${categorie.trim()} ». Choisissez une sous-catégorie proposée dans la liste.`
                      );
                      ev.target.value = sousCategorie;
                      return;
                    }
                    setSousCategorie(valeur);
                  }}
                  disabled={!categorieChoisie || sousCategories.length === 0}
                  className={champ}
                >
                  <option value="">
                    {sousCategories.length === 0 ? "Général" : "Choisir une sous-catégorie…"}
                  </option>
                  {sousCategories.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Exemple : Transport › Carburant, Factures › Facture SONEB.
                </p>
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

      <ErreurPopup ouvert={erreur !== null} message={erreur ?? ""} onFermer={() => setErreur(null)} />

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
