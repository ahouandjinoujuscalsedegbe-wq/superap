import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { creerDictee, demarrerDictee, dicteeDisponible } from "@/lib/dictee";
import { arreterLecture, lireAVoixHaute, vocalisationDisponible } from "@/lib/vocalisation";
import {
  choixParle,
  estArret,
  estPassage,
  estRepetition,
  nombreParle,
  reponseOuiNon,
  texteParle,
  type OptionVocale,
} from "@/lib/dialogue-vocal";

export type EtapeVocale = {
  id: string;
  /** Question posée à voix haute avant le champ. */
  question: string;
  type: "texte" | "nombre" | "choix" | "ouiNon";
  options?: OptionVocale[];
  /** L'étape est sautée (champ inutile dans le contexte actuel). */
  ignorer?: boolean;
  /** Enregistre la réponse comprise dans le formulaire. */
  appliquer: (valeur: string | number | boolean) => void;
  /** Phrase de confirmation lue après la réponse. */
  confirmation?: (valeur: string | number | boolean) => string;
};

/**
 * Discussion vocale interactive : l'application pose chaque question à voix
 * haute, écoute la réponse, la confirme, puis enchaîne sur le champ suivant.
 * Tout se passe sur l'appareil (synthèse et reconnaissance du téléphone).
 */
export function DialogueVocal({
  titre = "Remplir en parlant avec l'application",
  sousTitre = "L'application pose les questions à voix haute, vous répondez.",
  etapes,
  onTermine,
}: {
  titre?: string;
  sousTitre?: string;
  etapes: EtapeVocale[];
  onTermine?: () => void;
}) {
  const etapesRef = useRef(etapes);
  etapesRef.current = etapes;

  const [actif, setActif] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"parle" | "ecoute" | "attente">("attente");
  const [apercu, setApercu] = useState("");
  const [dernier, setDernier] = useState("");
  const reco = useRef<ReturnType<typeof creerDictee>>(null);
  const vivant = useRef(false);

  useEffect(
    () => () => {
      vivant.current = false;
      reco.current?.stop();
      arreterLecture();
    },
    [],
  );

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

  function libelleQuestion(etape: EtapeVocale): string {
    if (etape.type === "choix" && etape.options && etape.options.length > 0) {
      const liste = etape.options.map((o, i) => `${i + 1}. ${o.label}`).join(". ");
      return `${etape.question} Les choix sont : ${liste}.`;
    }
    if (etape.type === "ouiNon") return `${etape.question} Répondez par oui ou par non.`;
    return etape.question;
  }

  function terminer(message = "C'est terminé. Vérifiez les champs puis validez.") {
    reco.current?.stop();
    setPhase("parle");
    parler(message, () => {
      setActif(false);
      setPhase("attente");
    });
    vivant.current = false;
    setActif(false);
    onTermine?.();
  }

  function prochain(depuis: number) {
    const liste = etapesRef.current;
    let i = depuis;
    while (i < liste.length && liste[i]?.ignorer) i += 1;
    if (i >= liste.length) {
      vivant.current = true;
      terminer();
      return;
    }
    poser(i);
  }

  function poser(i: number) {
    const etape = etapesRef.current[i];
    if (!etape) {
      terminer();
      return;
    }
    setIndex(i);
    setApercu("");
    parler(libelleQuestion(etape), () => ecouter(i));
  }

  function ecouter(i: number) {
    if (!vivant.current) return;
    if (!dicteeDisponible()) {
      toast.error("La dictée vocale n'est pas disponible sur cet appareil.");
      vivant.current = false;
      setActif(false);
      return;
    }
    const instance = creerDictee(
      (texte, definitif) => {
        setApercu(texte);
        if (definitif) {
          reco.current = null;
          traiter(texte, i);
        }
      },
      (message) => {
        toast.error(message);
        if (vivant.current) {
          parler("Je n'ai pas entendu. Je répète.", () => poser(i));
        }
      },
      () => {
        setApercu("");
      },
    );
    if (!instance) return;
    reco.current = instance;
    setPhase("ecoute");
    void demarrerDictee(instance);
  }

  function traiter(texte: string, i: number) {
    if (!vivant.current) return;
    const propre = texte.trim();
    setDernier(propre);
    const etape = etapesRef.current[i];
    if (!etape) {
      terminer();
      return;
    }
    if (!propre) {
      parler("Je n'ai rien compris. Je répète la question.", () => poser(i));
      return;
    }
    if (estArret(propre)) {
      terminer("D'accord, j'arrête la discussion.");
      return;
    }
    if (estRepetition(propre)) {
      poser(i);
      return;
    }
    if (estPassage(propre)) {
      parler("Très bien, je passe.", () => prochain(i + 1));
      return;
    }

    let valeur: string | number | boolean | null = null;
    if (etape.type === "nombre") valeur = nombreParle(propre);
    else if (etape.type === "ouiNon") valeur = reponseOuiNon(propre);
    else if (etape.type === "choix") valeur = choixParle(propre, etape.options ?? []);
    else {
      const t = texteParle(propre);
      valeur = t.length > 0 ? t : null;
    }

    if (valeur === null) {
      parler(
        etape.type === "choix"
          ? "Je n'ai pas reconnu ce choix. Je répète les possibilités."
          : "Je n'ai pas compris votre réponse. Je répète la question.",
        () => poser(i),
      );
      return;
    }

    etape.appliquer(valeur);
    const confirmation = etape.confirmation?.(valeur) ?? `J'ai noté ${String(valeur)}.`;
    parler(confirmation, () => prochain(i + 1));
  }

  function demarrer() {
    if (!dicteeDisponible()) {
      toast.error("La dictée vocale n'est pas disponible sur cet appareil.");
      return;
    }
    vivant.current = true;
    setActif(true);
    setDernier("");
    const liste = etapesRef.current;
    let i = 0;
    while (i < liste.length && liste[i]?.ignorer) i += 1;
    parler(
      "Bonjour. Je vais vous poser quelques questions pour remplir le formulaire. Dites « passer » pour sauter une question, ou « stop » pour arrêter.",
      () => poser(i),
    );
  }

  function arreter() {
    vivant.current = false;
    reco.current?.stop();
    arreterLecture();
    setActif(false);
    setPhase("attente");
    setApercu("");
  }

  const etapeCourante = etapes[index];
  const restantes = etapes.filter((e) => !e.ignorer).length;
  const rang = etapes.slice(0, index + 1).filter((e) => !e.ignorer).length;

  return (
    <section className="carte space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{titre}</p>
          <p className="text-xs text-muted-foreground">{sousTitre}</p>
        </div>
        <button
          type="button"
          onClick={actif ? arreter : demarrer}
          aria-label={actif ? "Arrêter la discussion vocale" : "Démarrer la discussion vocale"}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors ${
            actif
              ? "animate-pulse border-destructive bg-destructive/15 text-destructive"
              : "border-input bg-card text-primary"
          }`}
        >
          {actif ? <Square className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {actif && (
        <div className="space-y-1 rounded-xl border border-input bg-background/50 p-3">
          <p className="flex items-center gap-2 text-xs font-medium text-primary">
            {phase === "parle" ? (
              <Volume2 className="h-4 w-4" aria-hidden />
            ) : (
              <Mic className="h-4 w-4" aria-hidden />
            )}
            Question {rang} sur {restantes}
          </p>
          <p className="text-sm">{etapeCourante?.question}</p>
          {etapeCourante?.type === "choix" && etapeCourante.options ? (
            <p className="text-xs text-muted-foreground">
              {etapeCourante.options.map((o, i) => `${i + 1}. ${o.label}`).join(" · ")}
            </p>
          ) : null}
          <p className="text-xs italic text-muted-foreground">
            {phase === "parle" ? "Je parle…" : apercu || "Je vous écoute…"}
          </p>
          {dernier ? <p className="text-xs text-muted-foreground">Vous : « {dernier} »</p> : null}
        </div>
      )}
    </section>
  );
}
