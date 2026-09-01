import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { creerDictee, demarrerDictee, dicteeDisponible } from "@/lib/dictee";
import { arreterLecture, lireAVoixHaute, vocalisationDisponible } from "@/lib/vocalisation";
import { estArret, estRepetition } from "@/lib/dialogue-vocal";

const OUVERTURES = [
  "Je vous écoute. Sur quoi voulez-vous des conseils aujourd'hui ?",
  "Posez-moi votre question de vive voix, par exemple : combien j'ai dépensé ce mois ?",
  "Dites-moi ce que vous voulez vérifier dans votre budget.",
];

/**
 * Discussion vocale avec le conseiller : il pose une question à voix haute,
 * l'utilisateur répond, le coach confirme ce qu'il a compris puis répond.
 * Synthèse et reconnaissance viennent du téléphone : rien n'est stocké ici.
 */
export function DiscussionVocaleCoach({
  onQuestion,
  onArret,
  demarrageAuto = false,
}: {
  /** Traite la question comprise et renvoie la réponse à lire à voix haute. */
  onQuestion: (question: string) => string;
  onArret?: () => void;
  /** Démarre la boucle vocale dès l'affichage, sans bouton supplémentaire. */
  demarrageAuto?: boolean;
}) {
  const [actif, setActif] = useState(false);
  const [phase, setPhase] = useState<"parle" | "ecoute" | "attente">("attente");
  const [apercu, setApercu] = useState("");
  const [derniere, setDerniere] = useState("");
  const reco = useRef<ReturnType<typeof creerDictee>>(null);
  const vivant = useRef(false);
  const question = useRef(OUVERTURES[0]!);
  const traite = useRef(onQuestion);
  traite.current = onQuestion;

  useEffect(
    () => () => {
      vivant.current = false;
      reco.current?.stop();
      arreterLecture();
    },
    [],
  );

  // Démarrage direct quand le composant s'ouvre en mode « mains libres ».
  const lance = useRef(false);
  useEffect(() => {
    if (demarrageAuto && !lance.current) {
      lance.current = true;
      demarrer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demarrageAuto]);

  function parler(texte: string, apres: () => void) {
    setPhase("parle");
    if (!vocalisationDisponible()) {
      apres();
      return;
    }
    lireAVoixHaute(texte, {
      onFin: () => {
        if (vivant.current) apres();
      },
      onErreur: () => {
        if (vivant.current) apres();
      },
    });
  }

  function ecouter() {
    if (!vivant.current) return;
    setPhase("ecoute");
    setApercu("");
    let entendu = "";
    const instance = creerDictee(
      (texte, definitif) => {
        setApercu(texte);
        if (definitif) entendu = texte;
      },
      (message) => {
        toast.error(message);
        arreter();
      },
      () => {
        if (!vivant.current) return;
        const dit = (entendu || apercu).trim();
        if (!dit) {
          parler("Je n'ai rien entendu. Reposez votre question.", ecouter);
          return;
        }
        repondreA(dit);
      },
    );
    if (!instance) {
      toast.error("La reconnaissance vocale n'est pas disponible sur cet appareil.");
      arreter();
      return;
    }
    reco.current = instance;
    void demarrerDictee(instance);
  }

  function repondreA(dit: string) {
    setDerniere(dit);
    setApercu("");
    if (estArret(dit)) {
      parler("Très bien, je m'arrête. À tout moment, rappelez-moi.", arreter);
      return;
    }
    if (estRepetition(dit)) {
      parler(question.current, ecouter);
      return;
    }
    const reponse = traite.current(dit);
    // Le coach confirme d'abord ce qu'il a compris, puis répond, puis relance.
    parler(`Vous m'avez demandé : ${dit}. ${reponse} Autre question ?`, () => {
      question.current = "Autre question ?";
      ecouter();
    });
  }

  function demarrer() {
    if (!dicteeDisponible()) {
      toast.error("La reconnaissance vocale n'est pas disponible sur cet appareil.");
      return;
    }
    vivant.current = true;
    setActif(true);
    setDerniere("");
    question.current = OUVERTURES[Math.floor(Math.random() * OUVERTURES.length)]!;
    parler(question.current, ecouter);
  }

  function arreter() {
    vivant.current = false;
    reco.current?.stop();
    reco.current = null;
    arreterLecture();
    setActif(false);
    setPhase("attente");
    setApercu("");
    onArret?.();
  }

  return (
    <section className="carte space-y-3 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Volume2 className="h-4 w-4 text-primary" aria-hidden />
            Parler avec mon conseiller
          </h2>
          <p className="text-xs text-muted-foreground">
            Il pose la question à voix haute, vous répondez, il confirme puis répond.
          </p>
        </div>
        <button
          type="button"
          onClick={actif ? arreter : demarrer}
          aria-label={actif ? "Arrêter la discussion vocale" : "Démarrer la discussion vocale"}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 ${
            actif ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
          }`}
        >
          {actif ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {actif && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {phase === "parle"
            ? "Le conseiller parle…"
            : phase === "ecoute"
              ? apercu
                ? `J'entends : « ${apercu} »`
                : "À vous de parler…"
              : "…"}
        </p>
      )}

      {derniere && !actif && (
        <p className="text-xs text-muted-foreground">Dernière question dite : « {derniere} »</p>
      )}
    </section>
  );
}
