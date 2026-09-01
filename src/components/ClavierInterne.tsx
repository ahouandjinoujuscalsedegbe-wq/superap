import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowBigUp,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardPaste,
  Copy,
  CornerDownLeft,
  Delete,
  Eraser,
  Languages,
  Smile,
  X,
} from "lucide-react";
import {
  retourTouche,
  useReglagesClavier,
  type Disposition,
  type ReglagesClavier,
  type Taille,
} from "@/lib/clavier-reglages";
import { apprendrePhrase, apprendreMot, suggerer } from "@/lib/clavier-mots";

/**
 * Clavier interne à l'application, inspiré du clavier d'Android 16
 * (Material 3 Expressive / Gboard) :
 * bulle d'aperçu, appui long pour les accents et chiffres, barre de
 * suggestions apprenantes, correction automatique, pages de symboles,
 * panneau d'émojis, glissement sur la barre d'espace, majuscules verrouillées,
 * outils de curseur et presse-papiers — le tout 100 % hors ligne.
 *
 * Il s'active dès qu'un champ reçoit le focus et empêche l'ouverture du
 * clavier natif (inputMode="none"). `data-clavier="off"` laisse le champ au
 * clavier système.
 */

type Mode = "texte" | "numerique" | "symboles" | "symboles2" | "emoji";
type Casse = "min" | "maj" | "verrou";

const RANGEE_CHIFFRES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

const DISPOSITIONS: Record<Disposition, string[][]> = {
  azerty: [
    ["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
    ["w", "x", "c", "v", "b", "n", "'", "-"],
  ],
  qwerty: [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
    ["z", "x", "c", "v", "b", "n", "'", "-"],
  ],
  alphabetique: [
    ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    ["k", "l", "m", "n", "o", "p", "q", "r", "s", "t"],
    ["u", "v", "w", "x", "y", "z", "'", "-"],
  ],
};

/** Pages de symboles, comme les pages « ?123 » et « =\< » d'Android. */
const SYMBOLES: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["@", "#", "€", "_", "&", "-", "+", "(", ")", "/"],
  ["*", '"', "'", ":", ";", "!", "?", ","],
];
const SYMBOLES_2: string[][] = [
  ["~", "`", "|", "•", "√", "π", "÷", "×", "¶", "∆"],
  ["£", "¢", "$", "¥", "^", "°", "=", "{", "}", "\\"],
  ["%", "©", "®", "™", "✓", "[", "]", "<", ">"],
];

/** Accents et variantes proposés par un appui long, comme sur Android. */
const VARIANTES: Record<string, string[]> = {
  a: ["à", "â", "ä", "á", "æ"],
  c: ["ç"],
  e: ["é", "è", "ê", "ë"],
  i: ["î", "ï", "í"],
  o: ["ô", "ö", "ó", "œ"],
  u: ["ù", "û", "ü"],
  y: ["ÿ"],
  n: ["ñ"],
  s: ["ß"],
  "'": ["’", "«", "»"],
  "-": ["–", "—", "_"],
  ".": [",", ";", ":", "…"],
  "0": ["°"],
};

/** Chiffre caché sous les lettres de la première rangée (appui long). */
function chiffreCache(disposition: Disposition, ligne: number, index: number): string | null {
  if (ligne !== 0 || index > 9) return null;
  void disposition;
  return RANGEE_CHIFFRES[index] ?? null;
}

const EMOJIS = [
  "😀","😃","😄","😁","😊","🙂","😉","😍","🥰","😘","😎","🤩","🤗","🤔","😐","😴",
  "😢","😭","😤","😡","🥳","🤝","👍","👎","👏","🙏","💪","✌️","👋","🫶","❤️","💛",
  "💚","💙","💜","🔥","✨","🎉","🎁","💰","💵","💳","🏦","📈","📉","🧾","🛒","🍚",
  "🍲","🥖","🍗","🥤","☕","🚕","🏍️","🚌","⛽","🏠","🏥","💊","🎓","📚","📱","💡",
  "🚿","🧴","👕","👗","💇","⚽","🎬","✈️","🕌","⛪","📅","⏰","✅","⚠️","❗","❓",
];
const CLE_EMOJIS_RECENTS = "superapp.clavier.emojis";

/** Raccourcis de montants proposés sur le pavé numérique. */
const RACCOURCIS = [
  { label: "000", ajout: "000" },
  { label: "+1 000", valeur: 1000 },
  { label: "+5 000", valeur: 5000 },
  { label: "+10 000", valeur: 10000 },
];
const ACCENTS = ["é", "è", "ê", "à", "ç", "ù", "ô", "î"];
const TOUCHES_NUM = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"];

/** Hauteur des touches selon la taille choisie dans les paramètres. */
const HAUTEURS: Record<Taille, { petite: string; pleine: string; large: string }> = {
  compacte: { petite: "h-9 text-sm", pleine: "h-9 text-sm", large: "h-10 text-sm" },
  normale: { petite: "h-11 text-[15px]", pleine: "h-11 text-[15px]", large: "h-12 text-base" },
  grande: { petite: "h-14 text-lg", pleine: "h-14 text-lg", large: "h-14 text-lg" },
};

type Champ = HTMLInputElement | HTMLTextAreaElement;

function estChampTexte(el: Element | null): el is Champ {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  const type = (el as HTMLInputElement).type;
  return ["text", "number", "search", "tel", "email", "url", "password"].includes(type);
}

/** Écrit une valeur dans un champ contrôlé par React, curseur compris. */
function ecrire(champ: Champ, valeur: string, curseur?: number) {
  const proto =
    champ.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(champ, valeur);
  champ.dispatchEvent(new Event("input", { bubbles: true }));
  if (curseur !== undefined) {
    try {
      champ.setSelectionRange(curseur, curseur);
    } catch {
      /* les champs de type number n'acceptent pas la sélection */
    }
  }
}

/** Position du curseur (repli en fin de texte si le champ ne la donne pas). */
function selection(champ: Champ): [number, number] {
  const long = (champ.value ?? "").length;
  try {
    const d = champ.selectionStart;
    const f = champ.selectionEnd;
    if (d === null || f === null) return [long, long];
    return [d, f];
  } catch {
    return [long, long];
  }
}

export function ClavierInterne() {
  const reglages = useReglagesClavier();
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<Mode>("texte");
  const [casse, setCasse] = useState<Casse>("maj");
  const [decimale, setDecimale] = useState(false);
  const [numeriqueForce, setNumeriqueForce] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [apercu, setApercu] = useState<{ label: string; x: number; y: number } | null>(null);
  const [variantes, setVariantes] = useState<{
    touches: string[];
    x: number;
    y: number;
  } | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const champRef = useRef<Champ | null>(null);
  const clavierRef = useRef<HTMLDivElement | null>(null);
  const repetition = useRef<{ debut: number; boucle: number } | null>(null);
  const dernierShift = useRef(0);

  const majuscule = casse !== "min" || reglages.majusculesAuto;

  const fermer = useCallback(() => {
    setOuvert(false);
    champRef.current = null;
    setDecimale(false);
    setNumeriqueForce(false);
    setSuggestions([]);
    setApercu(null);
    setVariantes(null);
  }, []);

  /* ---------------- Édition du champ, au curseur ---------------- */

  const rafraichirSuggestions = useCallback(() => {
    if (!reglages.suggestions) return setSuggestions([]);
    const champ = champRef.current;
    if (!champ || mode === "numerique") return setSuggestions([]);
    const [d] = selection(champ);
    const avant = (champ.value ?? "").slice(0, d);
    const motEnCours = /[\p{L}'-]+$/u.exec(avant)?.[0] ?? "";
    setSuggestions(suggerer(motEnCours));
  }, [mode, reglages.suggestions]);

  /** Insère du texte à l'emplacement exact du curseur. */
  const inserer = useCallback(
    (texte: string) => {
      const champ = champRef.current;
      if (!champ) return;
      const valeur = champ.value ?? "";
      const [d, f] = selection(champ);
      ecrire(champ, valeur.slice(0, d) + texte + valeur.slice(f), d + texte.length);
      window.setTimeout(rafraichirSuggestions, 0);
    },
    [rafraichirSuggestions],
  );

  const taper = (touche: string) => {
    const champ = champRef.current;
    if (!champ) return;
    let ajout = touche;
    if (mode === "numerique") {
      if (ajout === ".") {
        if (!decimale || (champ.value ?? "").includes(".")) return;
      } else if (!/^\d$/.test(ajout)) {
        return;
      }
    } else if (majuscule) {
      ajout = ajout.toLocaleUpperCase("fr-FR");
    }
    inserer(ajout);
    if (casse === "maj") setCasse("min");
  };

  /** Insère un texte brut (chiffres, espace, symboles) sans filtrage de mode. */
  const taperTexte = (texte: string) => inserer(texte);

  /** Barre d'espace : corrige et mémorise le mot terminé. */
  const espace = () => {
    const champ = champRef.current;
    if (!champ) return;
    const valeur = champ.value ?? "";
    const [d, f] = selection(champ);
    const avant = valeur.slice(0, d);
    const mot = /[\p{L}'-]+$/u.exec(avant)?.[0] ?? "";
    let remplacement = " ";
    let debut = d;
    if (mot.length >= 3 && reglages.correctionAuto) {
      const [meilleur] = suggerer(mot, 1);
      // On ne corrige que les fautes proches, jamais un mot déjà connu.
      if (meilleur && meilleur.toLocaleUpperCase("fr-FR") !== mot.toLocaleUpperCase("fr-FR")) {
        const memeDebut = meilleur
          .toLocaleUpperCase("fr-FR")
          .startsWith(mot.toLocaleUpperCase("fr-FR"));
        if (!memeDebut) {
          debut = d - mot.length;
          remplacement = (majuscule ? meilleur.toLocaleUpperCase("fr-FR") : meilleur) + " ";
        }
      }
    }
    if (mot) apprendreMot(mot);
    ecrire(champ, valeur.slice(0, debut) + remplacement + valeur.slice(f), debut + remplacement.length);
    window.setTimeout(rafraichirSuggestions, 0);
  };

  /** Remplace le mot en cours par la suggestion choisie. */
  const appliquerSuggestion = (mot: string) => {
    const champ = champRef.current;
    if (!champ) return;
    const valeur = champ.value ?? "";
    const [d, f] = selection(champ);
    const avant = valeur.slice(0, d);
    const enCours = /[\p{L}'-]+$/u.exec(avant)?.[0] ?? "";
    const texte = (majuscule ? mot.toLocaleUpperCase("fr-FR") : mot) + " ";
    const debut = d - enCours.length;
    ecrire(champ, valeur.slice(0, debut) + texte + valeur.slice(f), debut + texte.length);
    apprendreMot(mot);
    setSuggestions([]);
  };

  const effacer = useCallback(() => {
    const champ = champRef.current;
    if (!champ) return;
    const valeur = champ.value ?? "";
    const [d, f] = selection(champ);
    if (d !== f) ecrire(champ, valeur.slice(0, d) + valeur.slice(f), d);
    else if (d > 0) ecrire(champ, valeur.slice(0, d - 1) + valeur.slice(d), d - 1);
    window.setTimeout(rafraichirSuggestions, 0);
  }, [rafraichirSuggestions]);

  const toutEffacer = () => {
    const champ = champRef.current;
    if (!champ) return;
    ecrire(champ, "", 0);
    setSuggestions([]);
  };

  const ajouterMontant = (valeur: number) => {
    const champ = champRef.current;
    if (!champ) return;
    const actuel = Number((champ.value ?? "").replace(/[^\d.-]/g, "")) || 0;
    ecrire(champ, String(actuel + valeur));
  };

  /** Déplace le curseur d'un caractère. */
  const deplacerCurseur = useCallback((pas: number) => {
    const champ = champRef.current;
    if (!champ) return;
    const [d, f] = selection(champ);
    const cible = Math.max(0, Math.min((champ.value ?? "").length, (pas < 0 ? d : f) + pas));
    try {
      champ.focus({ preventScroll: true });
      champ.setSelectionRange(cible, cible);
    } catch {
      /* champ sans sélection */
    }
  }, []);

  const copier = () => {
    const champ = champRef.current;
    if (!champ) return;
    const [d, f] = selection(champ);
    const texte = d === f ? (champ.value ?? "") : (champ.value ?? "").slice(d, f);
    void navigator.clipboard?.writeText(texte).catch(() => undefined);
  };

  const coller = () => {
    void navigator.clipboard
      ?.readText()
      .then((t) => t && inserer(t))
      .catch(() => undefined);
  };

  /** Effacement continu tant que la touche « supprimer » reste enfoncée. */
  const demarrerEffacement = () => {
    if (!reglages.effacementContinu || repetition.current) return;
    const boucle = window.setInterval(() => {
      const champ = champRef.current;
      if (!champ || !champ.value) return;
      retourTouche();
      effacer();
    }, 90);
    repetition.current = { debut: Date.now(), boucle };
  };
  const arreterEffacement = useCallback(() => {
    if (repetition.current) {
      window.clearInterval(repetition.current.boucle);
      repetition.current = null;
    }
  }, []);
  useEffect(() => arreterEffacement, [arreterEffacement]);

  const valider = () => {
    const champ = champRef.current;
    if (champ) apprendrePhrase(champ.value ?? "");
    champ?.blur();
    if (!reglages.resterOuvert) fermer();
  };

  /** Majuscule : un appui = une lettre, deux appuis rapides = verrouillage. */
  const basculerCasse = () => {
    const maintenant = Date.now();
    const doubleAppui = maintenant - dernierShift.current < 350;
    dernierShift.current = maintenant;
    setCasse((c) => (doubleAppui ? "verrou" : c === "min" ? "maj" : "min"));
  };

  /* ---------------- Émojis récents ---------------- */

  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(CLE_EMOJIS_RECENTS);
      if (brut) setRecents(JSON.parse(brut) as string[]);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const choisirEmoji = (emoji: string) => {
    inserer(emoji);
    setRecents((r) => {
      const suivant = [emoji, ...r.filter((e) => e !== emoji)].slice(0, 16);
      try {
        window.localStorage.setItem(CLE_EMOJIS_RECENTS, JSON.stringify(suivant));
      } catch {
        /* stockage indisponible */
      }
      return suivant;
    });
  };

  /* ---------------- Ouverture / fermeture ---------------- */

  useEffect(() => {
    if (!ouvert) return;
    const surRetour = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") fermer();
    };
    window.addEventListener("keydown", surRetour);
    return () => window.removeEventListener("keydown", surRetour);
  }, [fermer, ouvert]);

  // Réserve l'espace en bas de page et garde le champ actif visible.
  useEffect(() => {
    if (!ouvert) return;
    const champ = champRef.current;
    if (!champ) return;

    let animation = 0;
    let dernierPadding = "";

    const rendreVisible = () => {
      const clavier = clavierRef.current;
      const hauteurClavier = clavier ? clavier.getBoundingClientRect().height : 0;
      const padding = `${Math.round(hauteurClavier) + 16}px`;
      if (padding !== dernierPadding) {
        dernierPadding = padding;
        document.body.style.paddingBottom = padding;
        document.body.dataset["clavierOuvert"] = "true";
        document.documentElement.style.setProperty("--app-keyboard-height", `${hauteurClavier}px`);
      }

      const rect = champ.getBoundingClientRect();
      const limiteVisible = window.innerHeight - hauteurClavier - 12;
      if (rect.bottom > limiteVisible + 2 || rect.top < -2) {
        const decalage = rect.bottom - limiteVisible;
        window.scrollBy({ top: Math.max(decalage, rect.top - 12), behavior: "auto" });
      }
    };

    const planifier = () => {
      if (animation) return;
      animation = window.requestAnimationFrame(() => {
        animation = 0;
        rendreVisible();
      });
    };

    const surSaisie = (ev: Event) => {
      if (ev.target === champRef.current) planifier();
    };

    const t1 = window.setTimeout(planifier, 60);
    const t2 = window.setTimeout(planifier, 250);
    window.addEventListener("resize", planifier);
    document.addEventListener("input", surSaisie, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (animation) window.cancelAnimationFrame(animation);
      window.removeEventListener("resize", planifier);
      document.removeEventListener("input", surSaisie, true);
      document.body.style.paddingBottom = "";
      delete document.body.dataset["clavierOuvert"];
      document.documentElement.style.removeProperty("--app-keyboard-height");
    };
  }, [ouvert, mode, suggestions.length]);

  useEffect(() => {
    const onFocus = (ev: FocusEvent) => {
      const cible = ev.target as Element | null;
      if (!estChampTexte(cible)) return;
      if (cible.dataset["clavier"] === "off" || cible.readOnly || cible.disabled) return;
      if (!reglages.actif) return;

      champRef.current = cible;
      const modeOrigine =
        cible.getAttribute("data-inputmode-origine") ?? cible.getAttribute("inputmode") ?? "";
      if (!cible.hasAttribute("data-inputmode-origine")) {
        cible.setAttribute("data-inputmode-origine", modeOrigine);
      }
      cible.setAttribute("inputmode", "none");
      const numerique =
        (cible as HTMLInputElement).type === "number" ||
        cible.dataset["clavier"] === "numerique" ||
        ["numeric", "decimal", "tel"].includes(modeOrigine);
      setDecimale((cible as HTMLInputElement).type === "number" || modeOrigine === "decimal");
      setMode(numerique ? "numerique" : "texte");
      setNumeriqueForce(numerique);
      setCasse(reglages.majusculesAuto ? "verrou" : "maj");
      setSuggestions([]);
      setOuvert(true);
    };
    const onFocusOut = (ev: FocusEvent) => {
      const suivant = ev.relatedTarget as Element | null;
      if (suivant && suivant.closest?.("[data-clavier-interne]")) return;
      if (!estChampTexte(suivant))
        window.setTimeout(() => {
          if (!estChampTexte(document.activeElement)) fermer();
        }, 60);
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [fermer, reglages.actif, reglages.majusculesAuto]);

  useEffect(() => {
    if (!reglages.actif && ouvert) fermer();
  }, [reglages.actif, ouvert, fermer]);

  /* ---------------- Rendu ---------------- */

  const commun = useMemo(
    () => ({
      taille: reglages.taille,
      visuel: reglages.retourVisuel,
      apercuActif: reglages.apercuTouche,
      onApercu: setApercu,
      onVariantes: reglages.appuiLong ? setVariantes : undefined,
    }),
    [reglages.taille, reglages.retourVisuel, reglages.apercuTouche, reglages.appuiLong],
  );

  if (!ouvert) return null;

  const lignesSymboles = mode === "symboles" ? SYMBOLES : SYMBOLES_2;

  return (
    <div
      ref={clavierRef}
      data-clavier-interne
      data-theme-clavier={reglages.themeSombre ? "sombre" : undefined}
      onMouseDown={(e) => e.preventDefault()}
      className="app-keyboard clavier-m3 fixed inset-x-0 bottom-0 z-[70] max-h-[calc(100dvh-env(safe-area-inset-top,0px))] overflow-y-auto px-1.5 pt-1.5"
      role="group"
      aria-label="Clavier interne de l'application"
    >
      <div className="mx-auto max-w-md space-y-1.5">
        {/* Barre de suggestions apprenantes, façon Gboard */}
        {reglages.suggestions && mode !== "numerique" && mode !== "emoji" && (
          <div className="flex h-9 items-stretch gap-1 overflow-x-auto">
            {suggestions.length === 0 ? (
              <span className="flex flex-1 items-center justify-center text-[11px] font-medium text-muted-foreground">
                Clavier de l’application
              </span>
            ) : (
              suggestions.map((mot, i) => (
                <button
                  key={mot}
                  type="button"
                  {...proprietesAppui(() => appliquerSuggestion(mot))}
                  style={{ touchAction: "manipulation" }}
                  className={`min-w-20 flex-1 rounded-full px-3 text-[13px] ${
                    i === 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {majuscule ? mot.toLocaleUpperCase("fr-FR") : mot}
                </button>
              ))
            )}
            <button
              type="button"
              {...proprietesAppui(valider)}
              style={{ touchAction: "manipulation" }}
              aria-label="Fermer le clavier"
              className="grid w-8 place-items-center rounded-full text-muted-foreground"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Rangée d'outils : émojis, curseur, presse-papiers */}
        {reglages.barreOutils && (
          <div className="flex items-center gap-1 pb-0.5">
            {reglages.emojis && (
              <Outil
                label={<Smile aria-hidden className="h-4 w-4" />}
                actif={mode === "emoji"}
                onClick={() => setMode(mode === "emoji" ? "texte" : "emoji")}
                aria="Émojis"
              />
            )}
            <Outil
              label={<ArrowLeft aria-hidden className="h-4 w-4" />}
              onClick={() => deplacerCurseur(-1)}
              aria="Curseur à gauche"
            />
            <Outil
              label={<ArrowRight aria-hidden className="h-4 w-4" />}
              onClick={() => deplacerCurseur(1)}
              aria="Curseur à droite"
            />
            <Outil
              label={<Copy aria-hidden className="h-4 w-4" />}
              onClick={copier}
              aria="Copier"
            />
            <Outil
              label={<ClipboardPaste aria-hidden className="h-4 w-4" />}
              onClick={coller}
              aria="Coller"
            />
            <Outil
              label={<Eraser aria-hidden className="h-4 w-4" />}
              onClick={toutEffacer}
              aria="Tout effacer"
            />
            <div className="flex-1" />
            {!numeriqueForce && (
              <Outil
                label={<Languages aria-hidden className="h-4 w-4" />}
                onClick={() => setMode(mode === "numerique" ? "texte" : "numerique")}
                aria="Pavé numérique"
                actif={mode === "numerique"}
              />
            )}
            <Outil label={<X aria-hidden className="h-4 w-4" />} onClick={valider} aria="Fermer" />
          </div>
        )}

        {mode === "emoji" ? (
          <div className="space-y-1.5">
            {recents.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {recents.map((e) => (
                  <button
                    key={`r-${e}`}
                    type="button"
                    {...proprietesAppui(() => choisirEmoji(e))}
                    style={{ touchAction: "manipulation" }}
                    className="touche-m3 grid h-10 w-10 place-items-center text-xl"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto overscroll-contain">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  {...proprietesAppui(() => choisirEmoji(e))}
                  style={{ touchAction: "manipulation" }}
                  className="grid h-10 place-items-center rounded-xl text-xl active:bg-primary/20"
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Touche
                {...commun}
                onClick={() => setMode("texte")}
                label="ABC"
                fonction
                petite
              />
              <Touche
                {...commun}
                onClick={effacer}
                onMaintien={demarrerEffacement}
                onRelacher={arreterEffacement}
                label={<Delete aria-hidden className="h-4 w-4" />}
                fonction
                petite
              />
            </div>
          </div>
        ) : mode === "numerique" ? (
          <div className="space-y-1.5">
            {reglages.raccourcisMontants && (
              <div className="flex gap-1">
                {RACCOURCIS.map((r) => (
                  <Touche
                    {...commun}
                    key={r.label}
                    onClick={() => (r.valeur ? ajouterMontant(r.valeur) : taperTexte(r.ajout!))}
                    label={r.label}
                    fonction
                    petite
                  />
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {TOUCHES_NUM.filter((t) => t !== "." || decimale).map((t) => (
                <Touche {...commun} key={t} onClick={() => taper(t)} label={t} />
              ))}
              <Touche
                {...commun}
                onClick={effacer}
                onMaintien={demarrerEffacement}
                onRelacher={arreterEffacement}
                label={<Delete aria-hidden className="h-5 w-5" />}
                fonction
              />
            </div>
            <div className="flex gap-1.5">
              {reglages.toucheToutEffacer && (
                <Touche
                  {...commun}
                  onClick={toutEffacer}
                  label={<Eraser aria-hidden className="h-4 w-4" />}
                  fonction
                  petite
                />
              )}
              <button
                type="button"
                {...proprietesAppui(valider)}
                style={{ touchAction: "manipulation" }}
                className="flex flex-[3] items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.97]"
              >
                <Check aria-hidden className="h-4 w-4" /> Valider
              </button>
            </div>
          </div>
        ) : mode === "symboles" || mode === "symboles2" ? (
          <div className="space-y-1.5">
            {lignesSymboles.map((ligne, i) => (
              <div key={i} className="flex justify-center gap-1">
                {i === 2 && (
                  <Touche
                    {...commun}
                    onClick={() => setMode(mode === "symboles" ? "symboles2" : "symboles")}
                    label={mode === "symboles" ? "=\\<" : "?123"}
                    fonction
                    petite
                  />
                )}
                {ligne.map((t) => (
                  <Touche {...commun} key={t} onClick={() => taperTexte(t)} label={t} petite />
                ))}
                {i === 2 && (
                  <Touche
                    {...commun}
                    onClick={effacer}
                    onMaintien={demarrerEffacement}
                    onRelacher={arreterEffacement}
                    label={<Delete aria-hidden className="h-4 w-4" />}
                    fonction
                    petite
                  />
                )}
              </div>
            ))}
            <RangeeBas
              commun={commun}
              reglages={reglages}
              gauche={{ label: "ABC", onClick: () => setMode("texte") }}
              onEspace={espace}
              onGlisser={reglages.glissementEspace ? deplacerCurseur : undefined}
              onEntree={valider}
              onPoint={() => taperTexte(".")}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            {reglages.accents && (
              <div className="flex justify-center gap-1">
                {ACCENTS.map((t) => (
                  <Touche
                    {...commun}
                    key={t}
                    onClick={() => taper(t)}
                    label={majuscule ? t.toLocaleUpperCase("fr-FR") : t}
                    petite
                  />
                ))}
              </div>
            )}
            {reglages.rangeeChiffres && (
              <div className="flex justify-center gap-1">
                {RANGEE_CHIFFRES.map((t) => (
                  <Touche {...commun} key={t} onClick={() => taperTexte(t)} label={t} petite />
                ))}
              </div>
            )}
            {DISPOSITIONS[reglages.disposition].map((ligne, i) => (
              <div key={i} className="flex justify-center gap-1">
                {i === 2 && (
                  <Touche
                    {...commun}
                    onClick={basculerCasse}
                    label={<ArrowBigUp aria-hidden className="h-4 w-4" />}
                    actif={casse !== "min"}
                    verrou={casse === "verrou"}
                    fonction
                    petite
                  />
                )}
                {ligne.map((t, j) => (
                  <Touche
                    {...commun}
                    key={t}
                    onClick={() => taper(t)}
                    onVariante={(v) => taperTexte(majuscule ? v.toLocaleUpperCase("fr-FR") : v)}
                    variantes={[
                      ...(chiffreCache(reglages.disposition, i, j) && !reglages.rangeeChiffres
                        ? [chiffreCache(reglages.disposition, i, j)!]
                        : []),
                      ...(VARIANTES[t] ?? []),
                    ]}
                    indice={
                      !reglages.rangeeChiffres ? chiffreCache(reglages.disposition, i, j) : null
                    }
                    label={majuscule ? t.toLocaleUpperCase("fr-FR") : t}
                    petite
                  />
                ))}
                {i === 2 && (
                  <Touche
                    {...commun}
                    onClick={effacer}
                    onMaintien={demarrerEffacement}
                    onRelacher={arreterEffacement}
                    label={<Delete aria-hidden className="h-4 w-4" />}
                    fonction
                    petite
                  />
                )}
              </div>
            ))}
            <RangeeBas
              commun={commun}
              reglages={reglages}
              gauche={{ label: "?123", onClick: () => setMode("symboles") }}
              onEspace={espace}
              onGlisser={reglages.glissementEspace ? deplacerCurseur : undefined}
              onEntree={valider}
              onPoint={() => taperTexte(".")}
            />
          </div>
        )}
      </div>

      {/* Bulle d'aperçu de la touche appuyée */}
      {apercu && (
        <div
          className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-full rounded-xl bg-primary px-3 py-1.5 text-xl font-semibold text-primary-foreground shadow-lg"
          style={{ left: apercu.x, top: apercu.y - 6 }}
        >
          {apercu.label}
        </div>
      )}

      {/* Menu d'appui long : accents et variantes */}
      {variantes && (
        <div
          className="fixed z-[85] flex -translate-x-1/2 -translate-y-full gap-1 rounded-2xl border border-border bg-card p-1 shadow-xl"
          style={{ left: variantes.x, top: variantes.y - 6 }}
        >
          {variantes.touches.map((v) => (
            <button
              key={v}
              type="button"
              {...proprietesAppui(() => {
                variantesChoix.current?.(v);
                setVariantes(null);
              })}
              style={{ touchAction: "manipulation" }}
              className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-lg active:bg-primary/30"
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Touches                                                             */
/* ------------------------------------------------------------------ */

/**
 * Déclenchement d'une touche compatible avec toutes les WebView Android.
 * Certaines WebView n'émettent pas « pointerdown » : on écoute alors
 * « touchstart » / « mousedown », avec un repli sur « click ».
 */
const SUPPORTE_POINTER = typeof window !== "undefined" && "PointerEvent" in window;
let dernierAppui = 0;

function proprietesAppui(action: () => void) {
  const declencher = (event: { cancelable?: boolean; preventDefault: () => void }) => {
    if (event.cancelable !== false) event.preventDefault();
    dernierAppui = Date.now();
    retourTouche();
    action();
  };
  const repliClic = () => {
    if (Date.now() - dernierAppui < 500) return;
    retourTouche();
    action();
  };
  return SUPPORTE_POINTER
    ? { onPointerDown: declencher, onClick: repliClic }
    : { onTouchStart: declencher, onMouseDown: declencher, onClick: repliClic };
}

/** Action à exécuter lorsqu'une variante d'appui long est choisie. */
const variantesChoix: { current: ((v: string) => void) | null } = { current: null };

type Commun = {
  taille: Taille;
  visuel: boolean;
  apercuActif: boolean;
  onApercu: (a: { label: string; x: number; y: number } | null) => void;
  onVariantes: ((v: { touches: string[]; x: number; y: number } | null) => void) | undefined;
};

function Outil({
  label,
  onClick,
  aria,
  actif,
}: {
  label: React.ReactNode;
  onClick: () => void;
  aria: string;
  actif?: boolean;
}) {
  return (
    <button
      type="button"
      {...proprietesAppui(onClick)}
      style={{ touchAction: "manipulation" }}
      aria-label={aria}
      className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
        actif ? "bg-primary/25 text-primary" : "text-muted-foreground active:bg-secondary"
      }`}
    >
      {label}
    </button>
  );
}

/** Rangée basse commune : symboles, virgule, espace, point, entrée. */
function RangeeBas({
  commun,
  reglages,
  gauche,
  onEspace,
  onGlisser,
  onEntree,
  onPoint,
}: {
  commun: Commun;
  reglages: ReglagesClavier;
  gauche: { label: string; onClick: () => void };
  onEspace: () => void;
  onGlisser?: ((pas: number) => void) | undefined;
  onEntree: () => void;
  onPoint: () => void;
}) {
  const depart = useRef<number | null>(null);
  const dernier = useRef(0);

  const glisse = (x: number) => {
    if (!onGlisser || depart.current === null) return;
    const delta = x - depart.current;
    const pas = Math.trunc(delta / 14);
    if (pas !== dernier.current) {
      onGlisser(pas - dernier.current);
      dernier.current = pas;
    }
  };

  return (
    <div className="flex gap-1">
      <Touche {...commun} onClick={gauche.onClick} label={gauche.label} fonction petite />
      <Touche {...commun} onClick={() => onPoint()} label="," petite />
      <button
        type="button"
        {...proprietesAppui(() => {
          if (dernier.current === 0) onEspace();
        })}
        onPointerDown={(e) => {
          depart.current = e.clientX;
          dernier.current = 0;
          retourTouche();
        }}
        onPointerMove={(e) => glisse(e.clientX)}
        onPointerUp={() => {
          if (dernier.current === 0) onEspace();
          depart.current = null;
          dernier.current = 0;
        }}
        onPointerCancel={() => {
          depart.current = null;
          dernier.current = 0;
        }}
        style={{ touchAction: "none" }}
        aria-label="Espace"
        className={`touche-m3 flex-[3] ${HAUTEURS[commun.taille].pleine} text-xs text-muted-foreground`}
      >
        {onGlisser ? "espace ⇆" : "espace"}
      </button>
      <Touche {...commun} onClick={onPoint} label="." petite />
      <button
        type="button"
        {...proprietesAppui(onEntree)}
        style={{ touchAction: "manipulation" }}
        aria-label="Valider"
        className={`flex flex-[1.4] items-center justify-center rounded-2xl bg-primary text-primary-foreground active:scale-[0.97] ${HAUTEURS[commun.taille].pleine}`}
      >
        {reglages.resterOuvert ? (
          <CornerDownLeft aria-hidden className="h-4 w-4" />
        ) : (
          <Check aria-hidden className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

function Touche({
  label,
  onClick,
  onMaintien,
  onRelacher,
  petite,
  pleine,
  actif,
  verrou,
  fonction,
  indice,
  variantes,
  onVariante,
  taille = "normale",
  visuel = true,
  apercuActif = true,
  onApercu,
  onVariantes,
}: Commun & {
  label: React.ReactNode;
  onClick: () => void;
  onMaintien?: (() => void) | undefined;
  onRelacher?: (() => void) | undefined;
  petite?: boolean | undefined;
  pleine?: boolean | undefined;
  actif?: boolean | undefined;
  verrou?: boolean | undefined;
  fonction?: boolean | undefined;
  indice?: string | null | undefined;
  variantes?: string[] | undefined;
  onVariante?: ((v: string) => void) | undefined;
}) {
  const h = HAUTEURS[taille];
  const ref = useRef<HTMLButtonElement | null>(null);
  const minuterie = useRef(0);

  const montrerApercu = () => {
    if (!apercuActif || typeof label !== "string" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    onApercu({ label, x: r.left + r.width / 2, y: r.top });
    window.setTimeout(() => onApercu(null), 420);
  };

  const ouvrirVariantes = () => {
    if (!onVariantes || !variantes?.length || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    variantesChoix.current = onVariante ?? null;
    retourTouche();
    onVariantes({ touches: variantes, x: r.left + r.width / 2, y: r.top });
  };

  const debutAppui = () => {
    montrerApercu();
    onMaintien?.();
    if (variantes?.length && onVariantes) {
      minuterie.current = window.setTimeout(ouvrirVariantes, 320);
    }
  };
  const finAppui = () => {
    window.clearTimeout(minuterie.current);
    onRelacher?.();
  };

  const base = proprietesAppui(onClick);

  return (
    <button
      ref={ref}
      type="button"
      {...base}
      onPointerDown={(e) => {
        (base as { onPointerDown?: (ev: unknown) => void }).onPointerDown?.(e);
        debutAppui();
      }}
      onTouchStart={(e) => {
        (base as { onTouchStart?: (ev: unknown) => void }).onTouchStart?.(e);
        debutAppui();
      }}
      onPointerUp={finAppui}
      onPointerLeave={finAppui}
      onPointerCancel={finAppui}
      onTouchEnd={finAppui}
      onTouchCancel={finAppui}
      style={{ touchAction: "manipulation" }}
      className={`touche-m3 relative select-none font-medium ${
        visuel ? "active:scale-[0.94] active:bg-primary/30" : ""
      } ${
        actif
          ? verrou
            ? "bg-primary text-primary-foreground"
            : "bg-primary/25"
          : fonction
            ? "touche-fonction"
            : ""
      } ${pleine ? `flex-1 ${h.pleine}` : petite ? `min-w-8 flex-1 ${h.petite}` : h.large}`}
    >
      {indice && (
        <span className="absolute right-1 top-0.5 text-[9px] leading-none text-muted-foreground">
          {indice}
        </span>
      )}
      {label}
    </button>
  );
}
