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
import { deposerDansCloud, lireDepuisCloud } from "@/lib/coffre-cloud";
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
  const [occupe, setOccupe] = useState<"envoi" | "reprise" | "reconnexion" | null>(null);
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

  /** Dépose une copie chiffrée dans l'espace du compte, sans aucun e-mail. */
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
      const depose = await deposerDansCloud(email.trim(), secrete, courant.cetAppareil, {
        contenu: paquet.contenu,
        empreinte: paquet.empreinte,
        taille: paquet.taille,
      });
      if (!depose) {
        setErreur("Enregistrement impossible pour l'instant : réessayez dès que la connexion revient.");
        return;
      }
      ecrireReglagesMail({ ...lireReglagesMail(), email: email.trim(), configure: true });
      enregistrer(
        noterAppareil({ ...courant, actif: true }, courant.cetAppareil, {
          dernierEnvoi: new Date().toISOString(),
        }),
      );
      toast.success("Copie chiffrée enregistrée dans l'espace de votre compte.");
    } catch {
      setErreur("Enregistrement impossible pour l'instant (pas de connexion).");
    } finally {
      setOccupe(null);
    }
  }

  /** Applique une copie chiffrée à ce téléphone, en fusionnant. */
  async function appliquerCopie(contenu: string, secrete: string) {
    const brut = await dechiffrerCinqFois(contenu, secrete);
    const recu = JSON.parse(brut) as Partial<Etat>;
    if (!recu || !Array.isArray(recu.transactions)) {
      setErreur("Cette copie ne contient pas de données SUPER APP valides.");
      return false;
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
    await enregistrerPhrase(secrete);
    ecrireReglagesMail({ ...lireReglagesMail(), email: email.trim(), configure: true });
    enregistrer(
      noterAppareil({ ...courant, actif: true }, courant.cetAppareil, {
        dernierImport: new Date().toISOString(),
      }),
    );
    return true;
  }

  /** Reconnexion : récupère directement les données de l'espace du compte. */
  async function reconnecterAuCompte() {
    setErreur("");
    if (!estEmailValide(email)) {
      setErreur("Entrez l'adresse e-mail de votre compte.");
      return;
    }
    const secrete = phrase.trim() || (await lirePhrase()) || "";
    if (secrete.length < 1) {
      setErreur("Saisissez la phrase de récupération de votre compte.");
      return;
    }
    setOccupe("reconnexion");
    try {
      const copies = await lireDepuisCloud(email.trim(), secrete);
      const derniere = copies[0];
      if (!derniere) {
        setErreur(
          "Aucune copie trouvée pour ce compte : vérifiez l'adresse e-mail et la phrase de récupération.",
        );
        return;
      }
      const ok = await appliquerCopie(derniere.contenu, secrete);
      if (ok) setPhrase("");
    } catch {
      setErreur("Reconnexion impossible : vérifiez la phrase de récupération et la connexion.");
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
      const ok = await appliquerCopie(compact.slice(debut), phrase.trim());
      if (ok) {
        setColis("");
        setPhrase("");
      }
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
        Votre adresse e-mail sert de compte : vos données y sont enregistrées chiffrées,
        automatiquement et sans aucun e-mail. Sur un autre téléphone (ou après un problème), il
        suffit de vous reconnecter avec la même adresse et votre phrase de récupération : tout
        réapparaît, sans effacer ce qui est déjà là.
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
        Enregistrer maintenant dans mon compte
      </button>

      <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
        <p className="text-sm font-semibold">Retrouver mes données avec mon e-mail</p>
        <p className="text-xs text-muted-foreground">
          Saisissez l'adresse e-mail du compte et votre phrase de récupération : les données
          enregistrées reviennent directement, sans ouvrir votre boîte mail.
        </p>
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
          onClick={() => void reconnecterAuCompte()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {occupe === "reconnexion" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Smartphone className="h-4 w-4" aria-hidden />
          )}
          Retrouver mes données
        </button>
      </div>

      <div className="space-y-2 rounded-xl border border-border p-3">
        <p className="text-sm font-semibold">Autre méthode : coller une copie reçue par e-mail</p>
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
