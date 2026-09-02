/**
 * Vocalisation locale (synthèse vocale du téléphone, hors ligne).
 * Sert à lire à voix haute le résumé mensuel et les alertes.
 */

export function vocalisationDisponible(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Prépare un texte écrit pour l'oreille : sigles, symboles, listes. */
export function texteParlable(texte: string): string {
  return texte
    .replace(/^[-•]\s*/gm, "")
    .replace(/\[(\w+)\]/g, "")
    .replace(/FCFA/g, "francs CFA")
    .replace(/%/g, " pour cent")
    .replace(/\s*\/\s*100/g, " sur 100")
    .replace(/·/g, ",")
    .replace(/\n+/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function voixFrancaise(): SpeechSynthesisVoice | null {
  try {
    const voix = window.speechSynthesis.getVoices();
    return voix.find((v) => v.lang?.toLowerCase().startsWith("fr")) ?? null;
  } catch {
    return null;
  }
}

/**
 * Lit le texte à voix haute. Les phrases sont découpées : certains moteurs
 * Android coupent au-delà de ~200 caractères.
 */
export function lireAVoixHaute(
  texte: string,
  options: { onFin?: () => void; onErreur?: (message: string) => void } = {},
): void {
  if (!vocalisationDisponible()) {
    options.onErreur?.("La lecture à voix haute n'est pas disponible sur cet appareil.");
    return;
  }
  const propre = texteParlable(texte);
  if (!propre) {
    options.onErreur?.("Rien à lire pour le moment.");
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();

  const morceaux = decouper(propre, 180);
  const voix = voixFrancaise();
  morceaux.forEach((morceau, i) => {
    const u = new SpeechSynthesisUtterance(morceau);
    u.lang = "fr-FR";
    u.rate = 1;
    u.pitch = 1;
    if (voix) u.voice = voix;
    if (i === morceaux.length - 1) u.onend = () => options.onFin?.();
    u.onerror = () => options.onErreur?.("La lecture à voix haute a échoué.");
    synth.speak(u);
  });
}

export function arreterLecture(): void {
  if (!vocalisationDisponible()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* synthèse indisponible */
  }
}

/** Découpe un texte en segments courts, sans casser les phrases. */
export function decouper(texte: string, taille: number): string[] {
  const phrases = texte.match(/[^.!?]+[.!?]*\s*/g) ?? [texte];
  const morceaux: string[] = [];
  let courant = "";
  for (const phrase of phrases) {
    if (courant && courant.length + phrase.length > taille) {
      morceaux.push(courant.trim());
      courant = "";
    }
    if (phrase.length > taille) {
      if (courant.trim()) morceaux.push(courant.trim());
      courant = "";
      for (let i = 0; i < phrase.length; i += taille)
        morceaux.push(phrase.slice(i, i + taille).trim());
      continue;
    }
    courant += phrase;
  }
  if (courant.trim()) morceaux.push(courant.trim());
  return morceaux.filter(Boolean);
}
