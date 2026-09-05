import { useState } from "react";
import { LifeBuoy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp, type Etat } from "@/lib/store";
import {
  dechiffrerCinqFois,
  ecrireReglagesMail,
  enregistrerPhrase,
  lireReglagesMail,
} from "@/lib/sauvegarde-email";

/** Extrait le colis chiffré au milieu du texte d'un e-mail. */
function extraireColis(texte: string): string | null {
  const compact = texte.replace(/\s+/g, "");
  const debut = compact.indexOf("SAM5:");
  if (debut < 0) return null;
  return compact.slice(debut);
}

/**
 * Téléphone perdu : on récupère tout depuis la dernière copie reçue par
 * e-mail, en collant son contenu (ou en choisissant le fichier enregistré)
 * puis en saisissant la phrase de récupération.
 */
export function RecuperationNouveauTelephone() {
  const app = useSuperApp();
  const [texte, setTexte] = useState("");
  const [phrase, setPhrase] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  async function choisirFichier(fichier: File | undefined) {
    if (!fichier) return;
    setTexte(await fichier.text());
    setErreur("");
  }

  async function recuperer() {
    setErreur("");
    const colis = extraireColis(texte);
    if (!colis) {
      setErreur(
        "Collez le contenu du message de sauvegarde reçu par e-mail (il commence par SAM5:).",
      );
      return;
    }
    if (phrase.trim().length < 1) {
      setErreur("Saisissez votre phrase de récupération.");
      return;
    }
    setOccupe(true);
    try {
      const brut = await dechiffrerCinqFois(colis, phrase.trim());
      const donnees = JSON.parse(brut) as Partial<Etat>;
      if (!donnees || typeof donnees !== "object" || !Array.isArray(donnees.transactions)) {
        setErreur("Cette copie ne contient pas de données SUPER APP valides.");
        setOccupe(false);
        return;
      }
      app.remplacerEtat(donnees);
      await enregistrerPhrase(phrase.trim());
      ecrireReglagesMail({ ...lireReglagesMail(), configure: true });
      setTexte("");
      setPhrase("");
      toast.success("Vos données ont été récupérées sur ce téléphone.");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Récupération impossible.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section id="recuperation" className="carte space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <LifeBuoy className="h-4 w-4 text-primary" aria-hidden /> J'ai changé ou perdu mon téléphone
      </h2>
      <p className="text-xs text-muted-foreground">
        Ouvrez dans votre boîte mail le dernier message « SUPER APP — sauvegarde chiffrée », copiez
        tout le contenu du message et collez-le ci-dessous, puis saisissez votre phrase de
        récupération. Vos comptes, enveloppes et opérations reviennent sur ce téléphone.
      </p>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Contenu du message de sauvegarde</span>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={4}
          placeholder="SAM5:..."
          className="w-full rounded-xl border border-input bg-card px-3 py-2 font-mono text-xs"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Ou choisir le fichier enregistré</span>
        <input
          type="file"
          accept=".txt,.eml,.sam5,text/plain"
          onChange={(e) => void choisirFichier(e.target.files?.[0])}
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Phrase de récupération</span>
        <input
          type="password"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
      </label>

      {erreur ? <p className="text-sm font-semibold text-destructive">{erreur}</p> : null}

      <button
        type="button"
        disabled={occupe}
        onClick={() => void recuperer()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {occupe ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Récupérer mes données
      </button>

      <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
        Sans la phrase de récupération, personne ne peut ouvrir cette copie — pas même nous. Si vous
        l'avez modifiée, utilisez celle qui était active au moment de l'envoi de ce message.
      </p>
    </section>
  );
}
