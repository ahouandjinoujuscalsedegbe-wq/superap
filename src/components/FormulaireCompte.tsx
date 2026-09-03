import { useState } from "react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { grouperMontant, deGrouperMontant } from "@/lib/format";
import { ErreurPopup } from "@/components/ErreurPopup";
import { DicteeChamp } from "@/components/DicteeChamp";
import { analyserCompteDicte } from "@/lib/dictee-champs";
import { ChoixIcone } from "@/components/ChoixIcone";
import { suggererIcone } from "@/lib/icone-auto";

export type DemandeCompte =
  | { type: "creation"; nom: string; solde: number; disponible: boolean; emoji: string }
  | {
      type: "renommage";
      ancien: string;
      nom: string;
      ajustement: number;
      disponible: boolean;
      emoji: string;
    };

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

export function FormulaireCompte({
  compte,
  onDemande,
  onAnnuler,
}: {
  /** Nom du compte à modifier ; absent pour une création. */
  compte?: string;
  onDemande: (demande: DemandeCompte) => void;
  onAnnuler?: () => void;
}) {
  const { comptes, comptesExclus, iconesComptes, soldesParCompte } = useSuperApp();
  const creation = compte === undefined;

  const [nom, setNom] = useState(compte ?? "");
  const [solde, setSolde] = useState(
    compte !== undefined ? String(soldesParCompte[compte] ?? 0) : "",
  );
  const [disponible, setDisponible] = useState<boolean | null>(
    compte !== undefined ? !comptesExclus.includes(compte) : null,
  );
  const [emoji, setEmoji] = useState(
    compte !== undefined ? (iconesComptes[compte] ?? suggererIcone(compte, "compte")) : "👛",
  );
  const [emojiManuel, setEmojiManuel] = useState(compte !== undefined);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<{
    nom?: string;
    solde?: string;
    disponible?: string;
  }>({});

  function auTexteDicte(texte: string) {
    const lu = analyserCompteDicte(texte);
    if (!lu.nom && lu.soldeInitial === null) {
      setErreur("Phrase non comprise. Dites par exemple : « compte mobile money avec 25000 ».");
      return;
    }
    if (lu.nom) setNom(lu.nom.slice(0, 30));
    if (lu.soldeInitial !== null) setSolde(String(lu.soldeInitial));
    toast.success("Dictée prise en compte. Vérifiez avant de valider.");
  }

  function soumettre(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = nom.trim();
    const soldeSaisi = solde.trim() === "" ? 0 : Number(solde.replace(/[^\d-]/g, ""));
    const prochaines: { nom?: string; solde?: string; disponible?: string } = {};

    if (!valeur) prochaines.nom = "Donnez un nom au compte avant de valider.";
    else if (valeur.length > 30) prochaines.nom = "Nom trop long : 30 caractères maximum.";
    else if (creation && comptes.includes(valeur))
      prochaines.nom = `Le compte « ${valeur} » existe déjà. Choisissez un autre nom.`;
    else if (!creation && valeur !== compte && comptes.includes(valeur))
      prochaines.nom = `Le compte « ${valeur} » existe déjà. Choisissez un autre nom.`;

    if (!Number.isFinite(soldeSaisi) || soldeSaisi < 0)
      prochaines.solde = "Le solde doit être un nombre positif en francs CFA.";
    else if (soldeSaisi > 1_000_000_000)
      prochaines.solde = "Montant trop élevé : 1 000 000 000 FCFA au maximum.";

    if (disponible === null)
      prochaines.disponible = "Indiquez si ce compte est compté dans le solde disponible.";

    setErreurs(prochaines);
    if (Object.keys(prochaines).length > 0) return;

    if (creation) {
      onDemande({
        type: "creation",
        nom: valeur,
        solde: soldeSaisi,
        disponible: disponible === true,
        emoji: emoji.trim() || suggererIcone(valeur, "compte"),
      });
      return;
    }
    const ancien = compte;
    const ajustement = soldeSaisi - (soldesParCompte[ancien] ?? 0);
    const disponibleActuel = !comptesExclus.includes(ancien);
    const iconeActuelle = iconesComptes[ancien] ?? "";
    if (
      valeur === ancien &&
      ajustement === 0 &&
      disponible === disponibleActuel &&
      emoji.trim() === iconeActuelle
    ) {
      setErreur(
        "Rien n'a changé : modifiez le nom, le solde, le logo ou le disponible, ou annulez.",
      );
      return;
    }
    onDemande({
      type: "renommage",
      ancien,
      nom: valeur,
      ajustement,
      disponible: disponible === true,
      emoji: emoji.trim(),
    });
  }

  return (
    <div className="space-y-3">
      <DicteeChamp
        titre="Dicter le compte"
        exemple="compte mobile money avec un solde initial de 25000 francs"
        onTexte={auTexteDicte}
      />

      <form onSubmit={soumettre} className="space-y-3">
        <div>
          <label htmlFor="c-nom" className="text-sm font-medium">
            Nom du compte
          </label>
          <input
            id="c-nom"
            autoFocus
            value={nom}
            onChange={(ev) => {
              const valeur = ev.target.value;
              setNom(valeur);
              if (!emojiManuel) setEmoji(suggererIcone(valeur, "compte"));
            }}
            placeholder="Tontine du quartier"
            className={champ}
          />
          {erreurs.nom ? (
            <p role="alert" className="mt-1 text-xs font-medium text-destructive">
              {erreurs.nom}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">30 caractères maximum.</p>
          )}
        </div>

        <ChoixIcone
          nom={nom}
          domaine="compte"
          valeur={emoji}
          titre="Logo du compte proposé"
          onChoisir={(e) => {
            setEmojiManuel(true);
            setEmoji(e);
          }}
        />

        <div>
          <label htmlFor="c-solde" className="text-sm font-medium">
            {creation ? "Solde initial (FCFA)" : "Solde actuel (FCFA)"}
          </label>
          <input
            id="c-solde"
            inputMode="numeric"
            value={grouperMontant(solde)}
            onChange={(ev) => setSolde(deGrouperMontant(ev.target.value))}
            placeholder="0"
            className={champ}
          />
          {erreurs.solde ? (
            <p role="alert" className="mt-1 text-xs font-medium text-destructive">
              {erreurs.solde}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {creation
                ? "Laissez 0 si le compte est vide."
                : "Une correction crée une opération d'ajustement."}
            </p>
          )}
        </div>

        <fieldset className="rounded-xl border border-input bg-background/60 p-3">
          <legend className="px-1 text-sm font-medium">Solde disponible</legend>
          <p className="text-xs text-muted-foreground">
            Choisissez si le solde de ce compte entre dans le solde disponible du foyer.
          </p>
          <div className="mt-2 space-y-2">
            <label className="flex items-start gap-3">
              <input
                type="radio"
                name="c-disponible"
                checked={disponible === true}
                onChange={() => setDisponible(true)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="min-w-0 text-sm">
                Compté dans le solde disponible
                <span className="block text-xs text-muted-foreground">
                  Compte courant, mobile money, espèces du quotidien.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="radio"
                name="c-disponible"
                checked={disponible === false}
                onChange={() => setDisponible(false)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="min-w-0 text-sm">
                Exclu du solde disponible
                <span className="block text-xs text-muted-foreground">
                  Épargne, caisse, compte diamant : le solde reste protégé.
                </span>
              </span>
            </label>
          </div>
          {erreurs.disponible && (
            <p role="alert" className="mt-2 text-xs font-medium text-destructive">
              {erreurs.disponible}
            </p>
          )}
        </fieldset>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
          >
            {creation ? "Ajouter" : "Enregistrer"}
          </button>
          {onAnnuler && (
            <button
              type="button"
              onClick={onAnnuler}
              className="flex-1 rounded-xl border border-input py-3 font-medium transition-colors hover:bg-accent/40"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <ErreurPopup
        ouvert={erreur !== null}
        message={erreur ?? ""}
        onFermer={() => setErreur(null)}
      />
    </div>
  );
}
