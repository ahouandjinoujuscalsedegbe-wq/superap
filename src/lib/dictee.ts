/** Accès à la reconnaissance vocale du navigateur (Web Speech API). */

import { journalAvertissement, journalErreur, journalInfo } from "@/lib/journal";
import { MESSAGE_MICRO_REFUSE, assurerMicro } from "@/lib/micro";
import { nettoyerDictee } from "@/lib/dictee-texte";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

export function dicteeDisponible(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function creerDictee(
  onTexte: (texte: string, definitif: boolean) => void,
  onErreur: (message: string) => void,
  onFin: () => void,
): Recognition | null {
  if (!dicteeDisponible()) return null;
  const w = window as any;
  const Constructeur = w.SpeechRecognition || w.webkitSpeechRecognition;
  const reco: Recognition = new Constructeur();
  reco.lang = "fr-FR";
  reco.continuous = false;
  reco.interimResults = true;
  reco.onresult = (e: any) => {
    let texte = "";
    let definitif = false;
    for (let i = 0; i < e.results.length; i += 1) {
      texte += e.results[i][0].transcript;
      if (e.results[i].isFinal) definitif = true;
    }
    // Le texte brut est remis au propre : vocabulaire du budget, nombres en
    // chiffres, ponctuation dictée, hésitations retirées.
    const propre = nettoyerDictee(texte);
    if (definitif) {
      journalInfo("dictee", "Dictée transcrite", {
        caracteres: propre.length,
        confiance: Math.round(((e?.results?.[0]?.[0]?.confidence ?? 0) as number) * 100),
      });
    }
    onTexte(propre, definitif);
  };
  reco.onerror = (e: any) => {
    const code = String(e?.error ?? "");
    const messages: Record<string, string> = {
      "not-allowed": "Micro refusé : autorisez l'accès au microphone dans votre navigateur.",
      "no-speech": "Aucune parole détectée. Réessayez en parlant plus près du micro.",
      "audio-capture": "Aucun micro détecté sur cet appareil.",
      network: "Reconnaissance vocale indisponible : vérifiez votre connexion.",
    };
    const message = messages[code] ?? "La dictée a échoué. Réessayez.";
    if (code === "no-speech" || code === "aborted") {
      journalAvertissement("dictee", message, { code });
    } else {
      journalErreur("dictee", message, { code });
    }
    onErreur(message);
  };
  reco.onend = onFin;
  return reco;
}

/**
 * Démarre la dictée après s'être assuré que le micro est autorisé.
 * Sur Android, c'est cet appel qui déclenche la boîte de dialogue système.
 */
export async function demarrerDictee(
  reco: Recognition | null | undefined,
  onErreur?: (message: string) => void,
): Promise<boolean> {
  if (!reco) return false;
  const autorise = await assurerMicro();
  if (!autorise) {
    journalAvertissement("dictee", MESSAGE_MICRO_REFUSE);
    onErreur?.(MESSAGE_MICRO_REFUSE);
    reco.onerror?.({ error: "not-allowed" });
    return false;
  }
  try {
    reco.start();
    return true;
  } catch (erreur) {
    journalErreur("dictee", "Impossible de démarrer la dictée", {
      nom: String((erreur as Error)?.name ?? erreur),
    });
    return false;
  }
}
