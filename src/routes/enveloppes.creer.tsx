import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { apprendreIcone, apprendreDepuisEnveloppes, suggererIcone } from "@/lib/icone-auto";
import { formatFCFA } from "@/lib/format";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";
import { DicteeChamp } from "@/components/DicteeChamp";
import { analyserEnveloppeDictee } from "@/lib/dictee-champs";

export const Route = createFileRoute("/enveloppes/creer")({
  head: () => ({
    meta: [
      { title: "Créer une enveloppe — SUPER APP" },
      {
        name: "description",
        content:
          "Page dédiée à la création d'une nouvelle enveloppe budgétaire : nom, plafond, somme attribuée, catégorie et sous-catégorie en francs CFA.",
      },
      { property: "og:title", content: "Créer une enveloppe — SUPER APP" },
      {
        property: "og:description",
        content: "Créez une enveloppe budgétaire guidée par des questions claires, en FCFA.",
      },
    ],
  }),
  component: CreerEnveloppePage,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none transition-shadow focus:ring-2 focus:ring-ring";

function CreerEnveloppePage() {
  const { ajouterEnveloppe, categories: listeCategories } = useSuperApp();
  const navigate = useNavigate();

  const [nom, setNom] = useState("");
  const [emoji, setEmoji] = useState("💡");
  const [emojiManuel, setEmojiManuel] = useState(false);
  const [plafond, setPlafond] = useState("");
  const [dotation, setDotation] = useState("");
  const [categorie, setCategorie] = useState("");
  const [sousCategorie, setSousCategorie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const [confirmation, setConfirmation] = useState<{
    nom: string;
    emoji: string;
    plafond: number;
    dotation: number;
    categorie: string;
    sousCategorie: string;
  } | null>(null);

  // Apprentissage local : les enveloppes déjà validées nourrissent l'IA d'icônes.
  const { enveloppes: enveloppesExistantes } = useSuperApp();
  useEffect(() => {
    apprendreDepuisEnveloppes(enveloppesExistantes);
  }, [enveloppesExistantes]);

  const categorieChoisie = listeCategories.find((c) => c.nom === categorie.trim());
  const sousCategories = categorieChoisie?.sousCategories ?? [];

  /** Dictée locale : remplit seul le nom, la somme placée et le plafond. */
  function appliquerDictee(texte: string) {
    const lu = analyserEnveloppeDictee(texte);
    if (lu.nom) {
      setNom(lu.nom);
      if (!emojiManuel) setEmoji(suggererIcone(lu.nom, "enveloppe"));
    }
    if (lu.dotation !== null) setDotation(String(lu.dotation));
    if (lu.plafond !== null) setPlafond(String(lu.plafond));
    if (!lu.nom && lu.dotation === null) {
      toast.warning(`« ${texte} » : rien compris, complétez à la main.`);
      return;
    }
    toast.success(
      `Compris : ${lu.nom || "sans nom"}${lu.dotation !== null ? ` · ${formatFCFA(lu.dotation)}` : ""}${
        lu.plafond !== null ? ` · plafond ${formatFCFA(lu.plafond)}` : ""
      }`,
    );
  }

  function valider(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = Number(plafond);
    if (!nom.trim()) {
      setErreur("Donnez un nom à l'enveloppe.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur < 0) {
      setErreur("Plafond invalide.");
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
        "La catégorie est obligatoire : choisissez-en une dans la liste avant de créer l'enveloppe.",
      );
      return;
    }
    if (!categorieChoisie) {
      setErreur(
        `La catégorie « ${categorie.trim()} » n'existe pas. Créez-la depuis « Gérer les catégories et sous-catégories ».`,
      );
      return;
    }
    if (sousCategories.length > 0 && !sousCategorie.trim()) {
      setErreur(
        "Cette catégorie possède des sous-catégories : choisissez-en une avant de créer l'enveloppe.",
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
    // L'IA locale retient l'association nom → icône pour s'améliorer.
    apprendreIcone(confirmation.nom, confirmation.emoji);
    setConfirmation(null);
    toast.success("Enveloppe ajoutée.");
    void navigate({ to: "/enveloppes/action" });
  }

  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/action" label="Retour aux actions" />

      <section className="carte space-y-1 p-4">
        <h2 className="text-lg font-semibold">Créer une nouvelle enveloppe</h2>
        <p className="text-sm text-muted-foreground">
          Répondez aux questions ci-dessous pour créer votre enveloppe budgétaire.
        </p>
      </section>

      <DicteeChamp
        titre="Dicter l'enveloppe"
        exemple="enveloppe transport avec 30000 francs, plafond 25000"
        onTexte={appliquerDictee}
      />

      <form onSubmit={valider} className="space-y-4">
        <section className="carte space-y-3 p-4">
          <p className="text-sm font-semibold">Comment s'appelle cette enveloppe ?</p>
          <div className="flex gap-2">
            <div className="w-20">
              <label htmlFor="e-emoji" className="text-xs text-muted-foreground">
                Emoji
              </label>
              <input
                id="e-emoji"
                value={emoji}
                onChange={(ev) => {
                  setEmojiManuel(true);
                  setEmoji(ev.target.value);
                }}
                className={champ}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="e-nom" className="text-xs text-muted-foreground">
                Nom
              </label>
              <input
                id="e-nom"
                value={nom}
                onChange={(ev) => {
                  const valeur = ev.target.value;
                  setNom(valeur);
                  if (!emojiManuel) setEmoji(suggererIcone(valeur, "enveloppe"));
                }}
                placeholder="Santé"
                className={champ}
              />
            </div>
          </div>
        </section>

        <section className="carte space-y-3 p-4">
          <p className="text-sm font-semibold">
            Quelle somme placez-vous réellement dans cette enveloppe ?
          </p>
          <input
            id="e-dotation"
            inputMode="numeric"
            value={dotation}
            onChange={(ev) => setDotation(ev.target.value.replace(/[^\d]/g, ""))}
            placeholder="30000"
            className={champ}
            aria-label="Somme attribuée en FCFA"
          />
          <p className="text-xs text-muted-foreground">
            Montant réellement disponible dans l'enveloppe (FCFA).
          </p>
        </section>

        <section className="carte space-y-3 p-4">
          <p className="text-sm font-semibold">
            Quel plafond de dépenses ne faut-il pas dépasser ?
          </p>
          <input
            id="e-plafond"
            inputMode="numeric"
            value={plafond}
            onChange={(ev) => setPlafond(ev.target.value.replace(/[^\d]/g, ""))}
            placeholder="25000"
            className={champ}
            aria-label="Plafond en FCFA"
          />
          <p className="text-xs text-muted-foreground">
            Au-delà du plafond, vous entrez en réserve. Il doit rester inférieur ou égal à la somme
            attribuée.
          </p>
        </section>

        <section className="carte space-y-3 p-4">
          <p className="text-sm font-semibold">Dans quelle catégorie la classer ?</p>
          <select
            id="e-categorie"
            value={categorie}
            onChange={(ev) => {
              setCategorie(ev.target.value);
              setSousCategorie("");
            }}
            className={champ}
            aria-label="Catégorie"
          >
            <option value="">Choisir une catégorie…</option>
            {listeCategories.map((c) => (
              <option key={c.id} value={c.nom}>
                {c.nom}
              </option>
            ))}
          </select>

          <label htmlFor="e-sous-categorie" className="text-xs text-muted-foreground">
            Sous-catégorie{sousCategories.length > 0 ? " (obligatoire)" : ""}
          </label>
          <select
            id="e-sous-categorie"
            value={sousCategorie}
            onChange={(ev) => setSousCategorie(ev.target.value)}
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
          <p className="text-xs text-muted-foreground">
            Exemple : Transport › Carburant, Factures › Facture SONEB.
          </p>
        </section>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
          >
            Créer l'enveloppe
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: "/enveloppes/action" })}
            className="flex-1 rounded-xl border border-input py-3 font-medium"
          >
            Annuler
          </button>
        </div>
      </form>

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
