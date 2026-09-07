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
  const [etape, setEtape] = useState<EtapeInstallation | null>(null);

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  const enCours = etape !== null && etape.etape !== "termine" && etape.etape !== "erreur";
  const termine = etape?.etape === "termine";
  const erreur = etape?.etape === "erreur";

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

        {etape && (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${
              erreur
                ? "bg-destructive/10 text-destructive"
                : termine
                  ? "bg-green-500/10 text-green-700"
                  : "bg-secondary"
            }`}
          >
            {etape.message}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={enCours}
            onClick={onFermer}
            title="Le rappel réapparaîtra dans 24 heures"
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {termine || erreur ? "Fermer" : "Plus tard"}
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={async () => {
              setEtape({ etape: "telechargement", message: "Téléchargement en cours..." });
              const resultat = await installerMiseAJour(manifeste.url, setEtape, {
                ...(manifeste.sha256 ? { sha256: manifeste.sha256 } : {}),
                ...(typeof manifeste.taille === "number" ? { taille: manifeste.taille } : {}),
              });
              if (!resultat.ok) {
                setEtape({ etape: "erreur", message: resultat.message });
              }
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
          >
            <Download aria-hidden className="h-4 w-4" />
            {enCours ? "Patientez..." : "Mettre à jour maintenant"}
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
    // La vérification n'a de sens que dans l'application installée : sur un
    // navigateur, l'appel à GitHub est refusé (CORS) et polluait la console.
    const surMobile =
      Boolean(import.meta.env["VITE_COQUE_MOBILE"]) ||
      Boolean((window as unknown as { Capacitor?: unknown }).Capacitor);
    if (!surMobile) return;
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
