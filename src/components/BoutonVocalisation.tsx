import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { arreterLecture, lireAVoixHaute, vocalisationDisponible } from "@/lib/vocalisation";

/**
 * Écoute le résumé au lieu de le lire : la synthèse vocale du téléphone lit
 * le texte fourni, entièrement hors ligne.
 */
export function BoutonVocalisation({
  texte,
  libelle = "Écouter le résumé",
  className = "",
}: {
  texte: () => string;
  libelle?: string;
  className?: string;
}) {
  const [parle, setParle] = useState(false);

  useEffect(() => () => arreterLecture(), []);

  function basculer() {
    if (parle) {
      arreterLecture();
      setParle(false);
      return;
    }
    if (!vocalisationDisponible()) {
      toast.error("La lecture à voix haute n'est pas disponible sur cet appareil.");
      return;
    }
    setParle(true);
    lireAVoixHaute(texte(), {
      onFin: () => setParle(false),
      onErreur: (message) => {
        toast.error(message);
        setParle(false);
      },
    });
  }

  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={parle ? "Arrêter la lecture à voix haute" : libelle}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground active:scale-95 ${className}`}
    >
      {parle ? (
        <VolumeX className="h-4 w-4 text-destructive" aria-hidden />
      ) : (
        <Volume2 className="h-4 w-4 text-primary" aria-hidden />
      )}
      {parle ? "Arrêter" : libelle}
    </button>
  );
}
