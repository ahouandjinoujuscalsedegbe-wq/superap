import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import {
  VERSION_APPLICATION,
  ignorerVersion,
  installerMiseAJour,
  verifierAuDemarrage,
  type EtapeInstallation,
  type Manifeste,
} from "@/lib/version";

/**
 * Boîte de dialogue de mise à jour, partagée par la vérification automatique
 * et la vérification manuelle des Paramètres.
 */
export function DialogueMiseAJour({
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
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-3 sm:items-center"
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

/**
 * Vérifie automatiquement les mises à jour à l'ouverture de l'application.
 * L'utilisateur n'a rien à configurer : si une version plus récente existe,
 * un pop-up s'affiche et un seul clic lance la mise à jour.
 */
export function MiseAJourAuto() {
  const [manifeste, setManifeste] = useState<Manifeste | null>(null);

  useEffect(() => {
    let actif = true;
    const minuteur = setTimeout(() => {
      verifierAuDemarrage()
        .then((trouve) => {
          if (actif && trouve) setManifeste(trouve);
        })
        .catch(() => {
          /* hors ligne : l'application continue normalement */
        });
    }, 2500);
    return () => {
      actif = false;
      clearTimeout(minuteur);
    };
  }, []);

  if (!manifeste) return null;

  return (
    <DialogueMiseAJour
      manifeste={manifeste}
      onFermer={() => {
        ignorerVersion(manifeste.version);
        setManifeste(null);
      }}
    />
  );
}
