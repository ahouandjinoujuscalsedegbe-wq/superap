import { useEffect, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";

import {
  VERSION_APPLICATION,
  enregistrerUrlManifeste,
  lancerTelechargement,
  lireDerniereVerification,
  lireUrlManifeste,
  verifierMiseAJour,
  type Manifeste,
  type ResultatVerification,
} from "@/lib/version";

/**
 * Vérification et installation des mises à jour de l'application.
 * Pensée pour un usage hors ligne : rien ne part sur Internet tant que
 * l'utilisateur n'appuie pas lui-même sur le bouton de vérification.
 */
export function SectionMiseAJour() {
  const [url, setUrl] = useState("");
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
        L'application fonctionne entièrement hors ligne. La vérification n'a lieu que si vous
        appuyez sur le bouton ci-dessous, et vos données restent intactes après une mise à jour.
      </p>

      <label htmlFor="maj-url" className="block text-xs font-semibold text-muted-foreground">
        Adresse du fichier version.json
      </label>
      <input
        id="maj-url"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        data-majuscules="non"
        data-clavier="off"
        placeholder="https://exemple.com/version.json"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
      />

      <button
        type="button"
        onClick={verifier}
        disabled={enCours}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        <RefreshCw aria-hidden className={`h-4 w-4 ${enCours ? "animate-spin" : ""}`} />
        {enCours ? "Vérification en cours…" : "Vérifier les mises à jour"}
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

      {nouvelle && (
        <DialogueMiseAJour manifeste={nouvelle} onFermer={() => setNouvelle(null)} />
      )}
    </section>
  );
}

function DialogueMiseAJour({
  manifeste,
  onFermer,
}: {
  manifeste: Manifeste;
  onFermer: () => void;
}) {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Nouvelle version disponible"
      onClick={onFermer}
    >
      <div
        className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold">Nouvelle version {manifeste.version}</h3>
            <p className="text-xs text-muted-foreground">
              Vous utilisez actuellement la version {VERSION_APPLICATION}.
            </p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-full bg-secondary p-1.5"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        {manifeste.changelog && (
          <div className="max-h-52 overflow-y-auto whitespace-pre-line rounded-xl bg-secondary p-3 text-sm">
            {manifeste.changelog}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          L'installation se fait par-dessus l'application actuelle : toutes vos enveloppes,
          opérations et sauvegardes locales sont conservées.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onFermer}
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={() => {
              lancerTelechargement(manifeste.url);
              onFermer();
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Download aria-hidden className="h-4 w-4" /> Mettre à jour maintenant
          </button>
        </div>
      </div>
    </div>
  );
}
