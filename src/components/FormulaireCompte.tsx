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
  const [disponible, setDisponible] = useState(
    compte !== undefined ? !comptesExclus.includes(compte) : true,
  );
  const [emoji, setEmoji] = useState(
    compte !== undefined ? (iconesComptes[compte] ?? suggererIcone(compte, "compte")) : "👛",
  );
  const [emojiManuel, setEmojiManuel] = useState(compte !== undefined);
  const [erreur, setErreur] = useState<string | null>(null);

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
    if (!valeur) {
      setErreur("Donnez un nom au compte avant de valider.");
      return;
    }
    if (valeur.length > 30) {
      setErreur("Nom trop long : 30 caractères maximum.");
      return;
    }
    const soldeSaisi = solde.trim() === "" ? 0 : Number(solde.replace(/[^\d-]/g, ""));
    if (!Number.isFinite(soldeSaisi) || soldeSaisi < 0) {
      setErreur("Le solde doit être un nombre positif en francs CFA.");
      return;
    }
    if (creation) {
      if (comptes.includes(valeur)) {
        setErreur(`Le compte « ${valeur} » existe déjà. Choisissez un autre nom.`);
        return;
      }
      onDemande({
        type: "creation",
        nom: valeur,
        solde: soldeSaisi,
        disponible,
        emoji: emoji.trim() || suggererIcone(valeur, "compte"),
      });
      return;
    }
    const ancien = compte;
    const ajustement = soldeSaisi - (soldesParCompte[ancien] ?? 0);
    if (valeur !== ancien && comptes.includes(valeur)) {
      setErreur(`Le compte « ${valeur} » existe déjà. Choisissez un autre nom.`);
      return;
    }
    if (valeur === ancien && ajustement === 0) {
      toast.success("Compte modifié.");
      onAnnuler?.();
      return;
    }
    onDemande({ type: "renommage", ancien, nom: valeur, ajustement, emoji: emoji.trim() });
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
          <p className="mt-1 text-xs text-muted-foreground">30 caractères maximum.</p>
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
          <p className="mt-1 text-xs text-muted-foreground">
            {creation
              ? "Laissez 0 si le compte est vide."
              : "Une correction crée une opération d'ajustement."}
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-input bg-background/60 p-3">
          <input
            type="checkbox"
            checked={disponible}
            onChange={(ev) => setDisponible(ev.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              Compter ce compte dans le solde disponible
            </span>
            <span className="block text-xs text-muted-foreground">
              Décochez pour une épargne, une caisse ou un compte diamant : son solde et les
              enveloppes alimentées par ce compte resteront hors du solde disponible.
            </span>
          </span>
        </label>

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
