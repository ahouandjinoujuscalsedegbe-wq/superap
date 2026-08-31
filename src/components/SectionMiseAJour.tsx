import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import {
  VERSION_APPLICATION,
  enregistrerTokenGithub,
  enregistrerUrlManifeste,
  lireDerniereVerification,
  lireTokenGithub,
  lireUrlManifeste,
  verifierMiseAJour,
  type Manifeste,
  type ResultatVerification,
} from "@/lib/version";
import { DialogueMiseAJour } from "@/components/MiseAJourAuto";

/**
 * Mises à jour de l'application.
 * L'application vérifie toute seule à l'ouverture ; ce bloc sert uniquement
 * à forcer une vérification immédiate et, si besoin, à changer l'adresse.
 */
export function SectionMiseAJour() {
  const [url, setUrl] = useState("");
  const [avance, setAvance] = useState(false);
  const [derniere, setDerniere] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ ton: "info" | "erreur"; texte: string } | null>(null);
  const [nouvelle, setNouvelle] = useState<Manifeste | null>(null);

  useEffect(() => {
    setUrl(lireUrlManifeste());
    setDerniere(lireDerniereVerification());
  }, []);

  const verifier = async () => {
    setEnCours(true);
    setMessage(null);
    enregistrerUrlManifeste(url);
    const resultat: ResultatVerification = await verifierMiseAJour(url);
    setEnCours(false);
    setDerniere(lireDerniereVerification());
    if (resultat.etat === "disponible") {
      setNouvelle(resultat.manifeste);
      return;
    }
    if (resultat.etat === "a-jour") {
      setMessage({
        ton: "info",
        texte: `Votre application est à jour (version ${resultat.version}).`,
      });
      return;
    }
    setMessage({ ton: "erreur", texte: resultat.message });
  };

  return (
    <section className="carte space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Mises à jour de l'application</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
          Version {VERSION_APPLICATION}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        L'application vérifie automatiquement les nouvelles versions à son ouverture. Quand une mise
        à jour existe, un message s'affiche et un seul clic suffit pour l'installer : vos données
        restent intactes.
      </p>

      <button
        type="button"
        onClick={verifier}
        disabled={enCours}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        <RefreshCw aria-hidden className={`h-4 w-4 ${enCours ? "animate-spin" : ""}`} />
        {enCours ? "Vérification en cours…" : "Vérifier maintenant"}
      </button>

      {derniere && (
        <p className="text-xs text-muted-foreground">
          Dernière vérification : {new Date(derniere).toLocaleString("fr-FR")}
        </p>
      )}

      {message && (
        <p
          role="status"
          className={`rounded-xl px-3 py-2 text-sm ${
            message.ton === "erreur"
              ? "bg-destructive/10 text-destructive"
              : "bg-secondary text-foreground"
          }`}
        >
          {message.texte}
        </p>
      )}

      <button
        type="button"
        onClick={() => setAvance((v) => !v)}
        className="text-xs font-semibold text-muted-foreground underline"
      >
        {avance ? "Masquer le réglage avancé" : "Réglage avancé (adresse des mises à jour)"}
      </button>

      {avance && (
        <>
          <label htmlFor="maj-url" className="block text-xs font-semibold text-muted-foreground">
            Adresse du fichier version.json
          </label>
          <input
            id="maj-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => enregistrerUrlManifeste(url)}
            data-majuscules="non"
            data-clavier="off"
            placeholder="https://exemple.com/version.json"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </>
      )}

      {nouvelle && <DialogueMiseAJour manifeste={nouvelle} onFermer={() => setNouvelle(null)} />}
    </section>
  );
}
