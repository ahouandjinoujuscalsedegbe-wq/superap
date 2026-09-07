import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { verifierIntegriteApp, type VerdictIntegrite } from "@/lib/integrite-app";

/**
 * Garde d'authenticité affichée au démarrage.
 *
 * - Application falsifiée (signature différente de l'officielle) : écran de
 *   blocage, aucune donnée n'est affichée ni déchiffrée.
 */
export function GardeIntegrite() {
  const [verdict, setVerdict] = useState<VerdictIntegrite | null>(null);

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

  return null;
}
