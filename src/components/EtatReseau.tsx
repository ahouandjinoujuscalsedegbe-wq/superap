import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { installerModeHorsLigne } from "@/lib/pwa";

/**
 * Bandeau discret signalant la perte de connexion.
 * Toutes les données étant locales, l'application reste pleinement utilisable.
 */
export function EtatReseau() {
  const [horsLigne, setHorsLigne] = useState(false);

  useEffect(() => {
    void installerModeHorsLigne();
  }, []);

  useEffect(() => {
    const majorer = () => setHorsLigne(!navigator.onLine);
    majorer();
    window.addEventListener("online", majorer);
    window.addEventListener("offline", majorer);
    return () => {
      window.removeEventListener("online", majorer);
      window.removeEventListener("offline", majorer);
    };
  }, []);

  if (!horsLigne) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-foreground/85 px-3 py-1.5 text-xs font-semibold text-background"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden />
      Hors ligne — vos données restent disponibles sur cet appareil
    </div>
  );
}
