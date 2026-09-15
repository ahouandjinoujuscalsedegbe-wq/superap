import { useEffect, useState } from "react";
import { LifeBuoy, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp, type Etat } from "@/lib/store";
import {
  dechiffrerCinqFois,
  ecrireReglagesMail,
  enregistrerPhrase,
  estEmailValide,
  lireReglagesMail,
} from "@/lib/sauvegarde-email";
import { chercherCopiesDuCompte, variantesPhrase } from "@/lib/coffre-cloud";

/** Extrait le colis chiffré au milieu du texte d'un e-mail. */
function extraireColis(texte: string): string | null {
  const compact = texte.replace(/\s+/g, "");
  const debut = compact.indexOf("SAM5:");
  if (debut < 0) return null;
  return compact.slice(debut);
}

/**
 * Nouveau téléphone (ou téléphone perdu, ou problème) : on se reconnecte avec
 * l'adresse e-mail du compte et la phrase de récupération, et tout revient
 * depuis l'espace de stockage chiffré rattaché à cette adresse. Aucun message
 * n'est ouvert ni envoyé. Coller une copie reçue par e-mail reste possible
 * comme deuxième méthode.
 */
export function RecuperationNouveauTelephone() {
  const app = useSuperApp();
  const [email, setEmail] = useState("");
  const [phrase, setPhrase] = useState("");
  const [texte, setTexte] = useState("");
  const [occupe, setOccupe] = useState<"compte" | "colle" | null>(null);
  const [erreur, setErreur] = useState("");
  const [autreMethode, setAutreMethode] = useState(false);

  useEffect(() => {
    setEmail(lireReglagesMail().email || "");
  }, []);

  /** Ouvre une copie chiffrée et remet les données sur ce téléphone. */
  async function appliquer(colis: string, secrete: string) {
    const brut = await dechiffrerCinqFois(colis, secrete);
    const donnees = JSON.parse(brut) as Partial<Etat>;
    if (!donnees || typeof donnees !== "object" || !Array.isArray(donnees.transactions)) {
      setErreur("Cette copie ne contient pas de données SUPER APP valides.");
      return false;
    }
    app.remplacerEtat(donnees);
    await enregistrerPhrase(secrete);
    ecrireReglagesMail({
      ...lireReglagesMail(),
      email: email.trim() || lireReglagesMail().email,
      configure: true,
      actif: true,
    });
    toast.success("Vos données ont été récupérées sur ce téléphone.");
    return true;
  }

  /** Méthode principale : reconnexion avec l'adresse e-mail du compte. */
  async function recupererAvecMonCompte() {
    setErreur("");
    if (!estEmailValide(email)) {
      setErreur("Entrez l'adresse e-mail que vous utilisiez sur votre ancien téléphone.");
      return;
    }
    if (phrase.trim().length < 1) {
      setErreur("Saisissez votre phrase de récupération.");
      return;
    }
    setOccupe("compte");
    try {
      const trouvees = await chercherCopiesDuCompte(email.trim(), phrase.trim());
      const derniere = trouvees.copies[0];
      if (!derniere) {
        setErreur(
          "Aucune copie trouvée : vérifiez l'adresse e-mail et la phrase de récupération, puis réessayez.",
        );
        return;
      }
      const ok = await appliquer(derniere.contenu, trouvees.phrase);
      if (ok) setPhrase("");
    } catch {
      setErreur(
        "Récupération impossible : vérifiez votre phrase de récupération et votre connexion Internet.",
      );
    } finally {
      setOccupe(null);
    }
  }

  async function choisirFichier(fichier: File | undefined) {
    if (!fichier) return;
    setTexte(await fichier.text());
    setErreur("");
  }

  /** Deuxième méthode : coller une copie reçue par e-mail. */
  async function recupererDepuisTexte() {
    setErreur("");
    const colis = extraireColis(texte);
    if (!colis) {
      setErreur("Collez le contenu du message de sauvegarde (il commence par SAM5:).");
      return;
    }
    if (phrase.trim().length < 1) {
      setErreur("Saisissez votre phrase de récupération.");
      return;
    }
    setOccupe("colle");
    try {
      let ok = false;
      for (const essai of variantesPhrase(phrase)) {
        try {
          ok = await appliquer(colis, essai);
          if (ok) break;
        } catch {
          /* on essaie la variante suivante de la phrase */
        }
      }
      if (!ok && !erreur) setErreur("Phrase de récupération incorrecte pour cette copie.");
      if (ok) {
        setTexte("");
        setPhrase("");
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Récupération impossible.");
    } finally {
      setOccupe(null);
    }
  }

  return (
    <section id="recuperation" className="carte space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <LifeBuoy className="h-4 w-4 text-primary" aria-hidden /> J'ai changé ou perdu mon téléphone
      </h2>
      <p className="text-xs text-muted-foreground">
        Saisissez l'adresse e-mail de votre compte et votre phrase de récupération : vos comptes,
        enveloppes, opérations, dettes et objectifs reviennent directement sur ce téléphone. Vous
        n'avez aucun message à ouvrir.
      </p>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Adresse e-mail de mon compte</span>
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-majuscules="non"
          placeholder="exemple@mail.com"
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Phrase de récupération</span>
        <input
          type="password"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          autoComplete="off"
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
      </label>

      {erreur ? <p className="text-sm font-semibold text-destructive">{erreur}</p> : null}

      <button
        type="button"
        disabled={occupe !== null}
        onClick={() => void recupererAvecMonCompte()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {occupe === "compte" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Smartphone className="h-4 w-4" aria-hidden />
        )}
        Récupérer mes données
      </button>

      <button
        type="button"
        onClick={() => setAutreMethode((v) => !v)}
        className="w-full rounded-xl border border-input px-3 py-2 text-xs font-semibold"
      >
        {autreMethode ? "Masquer l'autre méthode" : "Autre méthode : coller une copie reçue"}
      </button>

      {autreMethode ? (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">
            Si vous avez reçu un message « SUPER APP — sauvegarde chiffrée », copiez tout son
            contenu et collez-le ici, ou choisissez le fichier enregistré.
          </p>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={4}
            placeholder="SAM5:..."
            className="w-full rounded-xl border border-input bg-card px-3 py-2 font-mono text-xs"
          />
          <input
            type="file"
            accept=".txt,.eml,.sam5,text/plain"
            onChange={(e) => void choisirFichier(e.target.files?.[0])}
            className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={occupe !== null}
            onClick={() => void recupererDepuisTexte()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/60 px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-60"
          >
            {occupe === "colle" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Récupérer depuis cette copie
          </button>
        </div>
      ) : null}

      <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
        Sans la phrase de récupération, personne ne peut ouvrir vos copies — pas même nous.
      </p>
    </section>
  );
}
