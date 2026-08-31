import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { creerDictee, dicteeDisponible } from "@/lib/dictee";

/**
 * Bouton de dictée locale générique : capte une phrase, la renvoie brute au
 * formulaire qui l'analyse lui-même (enveloppe, objectif…).
 * Tout est traité sur l'appareil, sans aucun envoi de données.
 */
export function DicteeChamp({
  titre,
  exemple,
  onTexte,
}: {
  titre: string;
  exemple: string;
  onTexte: (texte: string) => void;
}) {
  const [ecoute, setEcoute] = useState(false);
  const [apercu, setApercu] = useState("");
  const reco = useRef<ReturnType<typeof creerDictee>>(null);

  useEffect(() => () => reco.current?.stop(), []);

  function demarrer() {
    if (!dicteeDisponible()) {
      toast.error("La dictée vocale n'est pas disponible sur cet appareil.");
      return;
    }
    const instance = creerDictee(
      (texte, definitif) => {
        setApercu(texte);
        if (definitif) {
          const propre = texte.trim();
          if (!propre) {
            toast.error("Aucune parole comprise. Réessayez plus près du micro.");
            return;
          }
          onTexte(propre);
        }
      },
      (message) => {
        toast.error(message);
        setEcoute(false);
      },
      () => {
        setEcoute(false);
        setApercu("");
      },
    );
    if (!instance) return;
    reco.current = instance;
    setApercu("");
    setEcoute(true);
    instance.start();
  }

  function arreter() {
    reco.current?.stop();
    setEcoute(false);
  }

  return (
    <section className="carte space-y-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{titre}</p>
          <p className="text-xs text-muted-foreground">Ex. : « {exemple} »</p>
        </div>
        <button
          type="button"
          onClick={ecoute ? arreter : demarrer}
          aria-label={ecoute ? "Arrêter la dictée" : "Démarrer la dictée"}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors ${
            ecoute
              ? "animate-pulse border-destructive bg-destructive/15 text-destructive"
              : "border-input bg-card text-primary"
          }`}
        >
          {ecoute ? <Square className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
        </button>
      </div>
      {ecoute && <p className="text-xs italic text-muted-foreground">{apercu || "Je vous écoute…"}</p>}
    </section>
  );
}
