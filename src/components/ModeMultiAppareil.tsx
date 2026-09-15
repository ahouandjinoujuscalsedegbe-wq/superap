import { useEffect, useState } from "react";
import { Loader2, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { useSuperApp, type Etat } from "@/lib/store";
import { instantaneEtat } from "@/lib/instantane";
import {
  dechiffrerCinqFois,
  ecrireReglagesMail,
  enregistrerPhrase,
  estEmailValide,
  lirePhrase,
  lireReglagesMail,
  preparerColis,
} from "@/lib/sauvegarde-email";
import { envoyerColisSauvegarde } from "@/lib/sauvegarde-email.functions";
import {
  ecrireReglagesMulti,
  fusionnerDonneesCompte,
  lireReglagesMulti,
  noterAppareil,
  type ReglagesMulti,
} from "@/lib/multi-appareil";

/**
 * Mode multi-appareil : votre adresse e-mail sert de compte commun. Chaque
 * téléphone y envoie une copie chiffrée ; un autre téléphone se reconnecte au
 * même compte et récupère les données manquantes sans écraser les siennes.
 */
export function ModeMultiAppareil() {
  const app = useSuperApp();
  const [reglages, setReglages] = useState<ReglagesMulti | null>(null);
  const [email, setEmail] = useState("");
  const [colis, setColis] = useState("");
  const [phrase, setPhrase] = useState("");
  const [occupe, setOccupe] = useState<"envoi" | "reprise" | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    setReglages(lireReglagesMulti());
    setEmail(lireReglagesMail().email || "");
  }, []);

  if (!reglages) return null;
  const courant: ReglagesMulti = reglages;

  function enregistrer(r: ReglagesMulti) {
    setReglages(r);
    ecrireReglagesMulti(r);
  }

  /** Envoie une copie chiffrée au compte e-mail depuis ce téléphone. */
  async function envoyerAuCompte() {
    setErreur("");
    if (!estEmailValide(email)) {
      setErreur("Entrez l'adresse e-mail qui sert de compte à vos téléphones.");
      return;
    }
    const secrete = await lirePhrase();
    if (!secrete) {
      setErreur("Enregistrez d'abord votre phrase de récupération dans la page Sauvegarde.");
      return;
    }
    setOccupe("envoi");
    try {
      const paquet = await preparerColis(instantaneEtat(app as unknown as Etat), secrete);
      const reponse = await envoyerColisSauvegarde({
        data: {
          email: email.trim(),
          appareil: courant.cetAppareil,
          colis: paquet.contenu,
          creeLe: new Date(paquet.creeLe).toLocaleString("fr-FR"),
        },
      });
      if (!reponse.envoye) {
        setErreur("L'envoi n'a pas abouti : réessayez dès que la connexion revient.");
        return;
      }
      ecrireReglagesMail({ ...lireReglagesMail(), email: email.trim(), configure: true });
      enregistrer(
        noterAppareil({ ...courant, actif: true }, courant.cetAppareil, {
          dernierEnvoi: new Date().toISOString(),
        }),
      );
      toast.success("Copie chiffrée envoyée à votre compte e-mail.");
    } catch {
      setErreur("Envoi impossible pour l'instant (pas de connexion).");
    } finally {
      setOccupe(null);
    }
  }

  /** Reprend les données du compte sur ce téléphone, en fusionnant. */
  async function reprendreDuCompte() {
    setErreur("");
    const compact = colis.replace(/\s+/g, "");
    const debut = compact.indexOf("SAM5:");
    if (debut < 0) {
      setErreur("Collez le contenu du dernier message « SUPER APP — sauvegarde chiffrée ».");
      return;
    }
    if (phrase.trim().length < 1) {
      setErreur("Saisissez la phrase de récupération de votre compte.");
      return;
    }
    setOccupe("reprise");
    try {
      const brut = await dechiffrerCinqFois(compact.slice(debut), phrase.trim());
      const recu = JSON.parse(brut) as Partial<Etat>;
      if (!recu || !Array.isArray(recu.transactions)) {
        setErreur("Cette copie ne contient pas de données SUPER APP valides.");
        return;
      }
      const fusion = fusionnerDonneesCompte(app as unknown as Etat, recu);
      if (fusion.total === 0) {
        toast("Ce téléphone était déjà à jour : rien à ajouter.");
      } else {
        app.remplacerEtat(fusion.etat);
        toast.success(
          `${fusion.total} élément(s) ajouté(s) : ${fusion.ajouts
            .map((a) => `${a.rubrique} ${a.nombre}`)
            .join(", ")}.`,
        );
      }
      await enregistrerPhrase(phrase.trim());
      ecrireReglagesMail({ ...lireReglagesMail(), email: email.trim(), configure: true });
      enregistrer(
        noterAppareil({ ...courant, actif: true }, courant.cetAppareil, {
          dernierImport: new Date().toISOString(),
        }),
      );
      setColis("");
      setPhrase("");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Reprise impossible.");
    } finally {
      setOccupe(null);
    }
  }

  return (
    <section id="multi-appareil" className="carte space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Smartphone className="h-4 w-4 text-primary" aria-hidden /> Plusieurs téléphones (mode
        multi-appareil)
      </h2>
      <p className="text-xs text-muted-foreground">
        Votre adresse e-mail sert de compte. Chaque téléphone y envoie une copie chiffrée de vos
        données ; sur un autre téléphone, vous vous reconnectez au même compte et tout ce qui manque
        est ajouté, sans effacer ce qui est déjà là.
      </p>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Adresse e-mail du compte</span>
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
        <span className="text-sm font-medium">Nom de ce téléphone</span>
        <input
          value={reglages.cetAppareil}
          onChange={(e) => enregistrer({ ...reglages, cetAppareil: e.target.value })}
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
      </label>

      <button
        type="button"
        disabled={occupe !== null}
        onClick={() => void envoyerAuCompte()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {occupe === "envoi" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Send className="h-4 w-4" aria-hidden />
        )}
        Envoyer maintenant à mon compte
      </button>

      <div className="space-y-2 rounded-xl border border-border p-3">
        <p className="text-sm font-semibold">Reconnecter ce téléphone au compte</p>
        <p className="text-xs text-muted-foreground">
          Ouvrez le dernier message de sauvegarde reçu sur cette adresse, copiez tout son contenu et
          collez-le ici : les données des deux téléphones seront réunies.
        </p>
        <textarea
          value={colis}
          onChange={(e) => setColis(e.target.value)}
          rows={3}
          placeholder="SAM5:..."
          className="w-full rounded-xl border border-input bg-card px-3 py-2 font-mono text-xs"
        />
        <input
          type="password"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="Phrase de récupération"
          autoComplete="off"
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={occupe !== null}
          onClick={() => void reprendreDuCompte()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/60 px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-60"
        >
          {occupe === "reprise" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Réunir les données sur ce téléphone
        </button>
      </div>

      {erreur ? <p className="text-sm font-semibold text-destructive">{erreur}</p> : null}

      {reglages.appareils.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {reglages.appareils.map((a) => (
            <li key={a.id}>
              <span className="font-semibold text-foreground">{a.nom}</span>
              {a.dernierEnvoi
                ? ` — copie envoyée le ${new Date(a.dernierEnvoi).toLocaleString("fr-FR")}`
                : ""}
              {a.dernierImport
                ? ` — données reprises le ${new Date(a.dernierImport).toLocaleString("fr-FR")}`
                : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
