import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { verifierIntegriteApp, type VerdictIntegrite } from "@/lib/integrite-app";

/**
 * Garde d'authenticité affichée au démarrage.
 *
 * - Application falsifiée (signature différente de l'officielle) : écran de
 *   blocage, aucune donnée n'est affichée ni déchiffrée.
 * - Appareil rooté ou émulateur : simple avertissement, la synchronisation
 *   en ligne est désactivée de son côté.
 */
export function GardeIntegrite() {
  const [verdict, setVerdict] = useState<VerdictIntegrite | null>(null);
  const [avertissementVu, setAvertissementVu] = useState(false);

  useEffect(() => {
    let vivant = true;
    verifierIntegriteApp().then((v) => {
      if (vivant) setVerdict(v);
    });
    return () => {
      vivant = false;
    };
  }, []);

  if (!verdict) return null;

  if (verdict.falsifiee) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto h-14 w-14 text-destructive" aria-hidden />
          <h1 className="mt-4 text-xl font-bold text-foreground">Application non authentique</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Cette copie de SUPER APP n'a pas été signée par l'éditeur officiel. Elle a pu être
            modifiée pour voler vos données. Désinstallez-la et réinstallez la version officielle.
          </p>
          <p className="mt-3 break-all text-[11px] text-muted-foreground/70">
            Empreinte lue : {verdict.signature || "inconnue"}
          </p>
        </div>
      </div>
    );
  }

  if (verdict.compromis && !avertissementVu) {
    return (
      <div className="fixed inset-x-3 bottom-24 z-[150] rounded-2xl border border-warning/40 bg-card p-4 shadow-lg">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Appareil non fiable</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cet appareil semble rooté ou émulé. Vos données restent chiffrées, mais la
              synchronisation entre appareils est désactivée par sécurité.
            </p>
            <button
              type="button"
              onClick={() => setAvertissementVu(true)}
              className="mt-3 min-h-11 rounded-xl bg-secondary px-4 text-sm font-medium text-secondary-foreground"
            >
              J'ai compris
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
