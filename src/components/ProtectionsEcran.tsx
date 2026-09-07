import { useEffect, useState } from "react";
import { EyeOff } from "lucide-react";
import { abonnerOptions, appliquerBlocageCaptures, lireOptions } from "@/lib/securite-avancee";

/**
 * Deux protections visuelles :
 * - masquage des montants quand l'application passe en arrière-plan ;
 * - blocage des captures d'écran et des aperçus (Android).
 */
export function ProtectionsEcran() {
  const [masque, setMasque] = useState(false);
  const [options, setOptions] = useState(() => lireOptions());

  useEffect(() => abonnerOptions(setOptions), []);

  useEffect(() => {
    void appliquerBlocageCaptures(options.blocageCaptures);
  }, [options.blocageCaptures]);

  useEffect(() => {
    if (!options.masquageArrierePlan) {
      setMasque(false);
      return;
    }
    const surVisibilite = () => setMasque(document.visibilityState === "hidden");
    const cacher = () => setMasque(true);
    const montrer = () => setMasque(false);
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("blur", cacher);
    window.addEventListener("focus", montrer);
    return () => {
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("blur", cacher);
      window.removeEventListener("focus", montrer);
    };
  }, [options.masquageArrierePlan]);

  if (!masque) return null;

  return (
    <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-3 bg-background">
      <EyeOff className="h-8 w-8 text-primary" aria-hidden />
      <p className="text-sm font-semibold">Contenu masqué</p>
      <p className="text-xs text-muted-foreground">Vos montants réapparaissent à votre retour.</p>
    </div>
  );
}
