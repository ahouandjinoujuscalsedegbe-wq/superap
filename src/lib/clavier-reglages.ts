/**
 * Réglages du clavier interne de l'application.
 *
 * Les préférences sont conservées localement (localStorage) et partagées
 * instantanément entre tous les composants grâce à un petit magasin maison.
 */

import { useSyncExternalStore } from "react";

export type Intensite = "legere" | "moyenne" | "forte";
export type Disposition = "azerty" | "qwerty" | "alphabetique";
export type Taille = "compacte" | "normale" | "grande";

export type ReglagesClavier = {
  /** Utiliser le clavier interne (sinon, clavier natif du téléphone). */
  actif: boolean;
  /** Vibration sous le doigt à chaque appui. */
  vibration: boolean;
  intensiteVibration: Intensite;
  /** Petit clic sonore à chaque appui. */
  son: boolean;
  volumeSon: number;
  /** Surbrillance de la touche appuyée. */
  retourVisuel: boolean;
  /** Disposition des lettres. */
  disposition: Disposition;
  /** Taille des touches. */
  taille: Taille;
  /** Rangée de lettres accentuées. */
  accents: boolean;
  /** Rangée de chiffres au-dessus des lettres. */
  rangeeChiffres: boolean;
  /** Majuscules automatiques (l'application écrit déjà tout en majuscules). */
  majusculesAuto: boolean;
  /** Touches rapides de montants (000, +1 000, +5 000…) sur le pavé numérique. */
  raccourcisMontants: boolean;
  /** Effacement continu en maintenant la touche « supprimer ». */
  effacementContinu: boolean;
  /** Effacer tout le champ d'un appui (touche dédiée). */
  toucheToutEffacer: boolean;
  /** Le clavier reste ouvert après validation d'un champ. */
  resterOuvert: boolean;
  /** Barre de suggestions de mots (dictionnaire local qui apprend). */
  suggestions: boolean;
  /** Correction du mot en cours dès l'appui sur espace. */
  correctionAuto: boolean;
  /** Bulle d'aperçu au-dessus de la touche appuyée. */
  apercuTouche: boolean;
  /** Appui long sur une lettre : accents et chiffres cachés. */
  appuiLong: boolean;
  /** Glisser sur la barre d'espace pour déplacer le curseur. */
  glissementEspace: boolean;
  /** Panneau d'émojis intégré au clavier. */
  emojis: boolean;
  /** Rangée d'outils : émojis, presse-papiers, curseurs, dictée. */
  barreOutils: boolean;
  /** Thème sombre du clavier (sinon suit l'application). */
  themeSombre: boolean;
};

export const REGLAGES_PAR_DEFAUT: ReglagesClavier = {
  actif: true,
  vibration: true,
  intensiteVibration: "moyenne",
  son: false,
  volumeSon: 0.3,
  retourVisuel: true,
  disposition: "azerty",
  taille: "normale",
  accents: true,
  rangeeChiffres: true,
  majusculesAuto: true,
  raccourcisMontants: true,
  effacementContinu: true,
  toucheToutEffacer: true,
  resterOuvert: false,
  suggestions: true,
  correctionAuto: true,
  apercuTouche: true,
  appuiLong: true,
  glissementEspace: true,
  emojis: true,
  barreOutils: true,
  themeSombre: false,
};


const CLE = "superapp.clavier.reglages";

let courant: ReglagesClavier = REGLAGES_PAR_DEFAUT;
let charge = false;
const abonnes = new Set<() => void>();

function lireStockage(): ReglagesClavier {
  if (typeof window === "undefined") return REGLAGES_PAR_DEFAUT;
  try {
    const brut = window.localStorage.getItem(CLE);
    if (!brut) return REGLAGES_PAR_DEFAUT;
    const objet = JSON.parse(brut) as Partial<ReglagesClavier>;
    return { ...REGLAGES_PAR_DEFAUT, ...objet };
  } catch {
    return REGLAGES_PAR_DEFAUT;
  }
}

/** Réglages actuels (lecture directe hors composant React). */
export function reglagesClavier(): ReglagesClavier {
  if (!charge) {
    courant = lireStockage();
    charge = true;
  }
  return courant;
}

/** Modifie un ou plusieurs réglages et prévient tous les abonnés. */
export function majReglagesClavier(patch: Partial<ReglagesClavier>) {
  courant = { ...reglagesClavier(), ...patch };
  try {
    window.localStorage.setItem(CLE, JSON.stringify(courant));
  } catch {
    /* stockage indisponible : les réglages restent valables pour la session */
  }
  abonnes.forEach((f) => f());
}

/** Remet tous les réglages du clavier à leurs valeurs d'origine. */
export function reinitialiserClavier() {
  majReglagesClavier(REGLAGES_PAR_DEFAUT);
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

/** Hook React : renvoie les réglages et se met à jour automatiquement. */
export function useReglagesClavier(): ReglagesClavier {
  return useSyncExternalStore(abonner, reglagesClavier, () => REGLAGES_PAR_DEFAUT);
}

/* ------------------------------------------------------------------ */
/* Retour physique : vibration et son                                  */
/* ------------------------------------------------------------------ */

const DUREES: Record<Intensite, number> = { legere: 8, moyenne: 18, forte: 35 };

type HapticsModule = {
  Haptics: { impact: (options: { style: string }) => Promise<void> };
  ImpactStyle: Record<string, string>;
};
let haptics: HapticsModule | null = null;
let hapticsDemande = false;

function estNatif(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

async function chargerHaptics() {
  if (hapticsDemande) return;
  hapticsDemande = true;
  try {
    haptics = (await import("@capacitor/haptics")) as unknown as HapticsModule;
  } catch {
    haptics = null;
  }
}

/** Vibration courte sous le doigt, selon les réglages de l'utilisateur. */
export function vibrerTouche(intensiteForcee?: Intensite) {
  const r = reglagesClavier();
  if (!r.vibration && !intensiteForcee) return;
  const intensite = intensiteForcee ?? r.intensiteVibration;

  if (estNatif()) {
    if (!haptics) {
      void chargerHaptics().then(() => vibrerNatif(intensite));
      return;
    }
    vibrerNatif(intensite);
    return;
  }
  try {
    navigator.vibrate?.(DUREES[intensite]);
  } catch {
    /* vibration non disponible sur cet appareil */
  }
}

function vibrerNatif(intensite: Intensite) {
  if (!haptics) return;
  const style =
    intensite === "legere"
      ? (haptics.ImpactStyle["Light"] ?? "LIGHT")
      : intensite === "forte"
        ? (haptics.ImpactStyle["Heavy"] ?? "HEAVY")
        : (haptics.ImpactStyle["Medium"] ?? "MEDIUM");
  void haptics.Haptics.impact({ style }).catch(() => {
    try {
      navigator.vibrate?.(DUREES[intensite]);
    } catch {
      /* ignoré */
    }
  });
}

let contexteAudio: AudioContext | null = null;

/** Petit clic sonore de touche, généré sans fichier audio. */
export function jouerClic(volumeForce?: number) {
  const r = reglagesClavier();
  const volume = volumeForce ?? (r.son ? r.volumeSon : 0);
  if (volume <= 0) return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    contexteAudio ??= new Ctx();
    const ctx = contexteAudio;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(Math.min(volume, 1) * 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    /* audio indisponible */
  }
}

/** Retour complet (vibration + son) déclenché à chaque appui de touche. */
export function retourTouche() {
  vibrerTouche();
  jouerClic();
}
