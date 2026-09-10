import { useEffect } from "react";

type ChampSaisie = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement;

const MARGE_HAUT = 12;
const MARGE_CLAVIER = 16;

function estChampSaisie(cible: EventTarget | null): cible is ChampSaisie {
  if (!(cible instanceof HTMLElement)) return false;
  if (cible instanceof HTMLTextAreaElement || cible instanceof HTMLSelectElement) return true;
  if (cible.isContentEditable) return true;
  if (!(cible instanceof HTMLInputElement)) return false;
  return ![
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(cible.type);
}

function peutDefiler(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
}

function conteneursDefilables(champ: HTMLElement): HTMLElement[] {
  const conteneurs: HTMLElement[] = [];
  let parent = champ.parentElement;
  while (parent && parent !== document.body) {
    if (peutDefiler(parent)) conteneurs.push(parent);
    parent = parent.parentElement;
  }
  return conteneurs;
}

/**
 * Maintient le champ actif dans la partie réellement visible de l'écran.
 * Le Visual Viewport décrit le clavier Android, tandis que l'événement
 * `super-app:clavier-hauteur` décrit le clavier interne superposé.
 */
export function ChampsVisiblesClavier() {
  useEffect(() => {
    let champActif: ChampSaisie | null = null;
    let hauteurClavierInterne = 0;
    let animation = 0;
    let rappel = 0;

    const replacer = () => {
      animation = 0;
      const champ = champActif;
      if (!champ || !champ.isConnected || document.activeElement !== champ) return;

      const viewport = window.visualViewport;
      const hautEcran = viewport?.offsetTop ?? 0;
      const basEcran = hautEcran + (viewport?.height ?? window.innerHeight) - hauteurClavierInterne;
      const limiteHaut = hautEcran + MARGE_HAUT;
      const limiteBas = Math.max(limiteHaut + 48, basEcran - MARGE_CLAVIER);

      // Les formulaires contenus dans une fenêtre ont leur propre défilement.
      // On corrige d'abord ces conteneurs, du plus proche au plus éloigné.
      for (const conteneur of conteneursDefilables(champ)) {
        const champRect = champ.getBoundingClientRect();
        const conteneurRect = conteneur.getBoundingClientRect();
        const hautVisible = Math.max(limiteHaut, conteneurRect.top + MARGE_HAUT);
        const basVisible = Math.min(limiteBas, conteneurRect.bottom - MARGE_CLAVIER);
        if (champRect.bottom > basVisible) {
          conteneur.scrollTop += champRect.bottom - basVisible;
        } else if (champRect.top < hautVisible) {
          conteneur.scrollTop -= hautVisible - champRect.top;
        }
      }

      const rect = champ.getBoundingClientRect();
      if (rect.bottom > limiteBas) {
        window.scrollBy({ top: rect.bottom - limiteBas, behavior: "auto" });
      } else if (rect.top < limiteHaut) {
        window.scrollBy({ top: rect.top - limiteHaut, behavior: "auto" });
      }
    };

    const planifier = (delai = 0) => {
      window.clearTimeout(rappel);
      rappel = window.setTimeout(() => {
        if (animation) window.cancelAnimationFrame(animation);
        animation = window.requestAnimationFrame(replacer);
      }, delai);
    };

    const surFocus = (evenement: FocusEvent) => {
      if (!estChampSaisie(evenement.target)) return;
      champActif = evenement.target;
      planifier();
      // Android annonce parfois la taille finale du clavier après l'événement focus.
      planifier(100);
    };
    const surPerteFocus = (evenement: FocusEvent) => {
      if (evenement.target === champActif && !estChampSaisie(evenement.relatedTarget)) {
        champActif = null;
      }
    };
    const surSaisie = (evenement: Event) => {
      if (evenement.target === champActif) planifier();
    };
    const surClavierInterne = (evenement: Event) => {
      const hauteur = (evenement as CustomEvent<number>).detail;
      hauteurClavierInterne = Number.isFinite(hauteur) ? Math.max(0, hauteur) : 0;
      planifier();
      planifier(80);
    };
    const surViewport = () => planifier();

    document.addEventListener("focusin", surFocus, true);
    document.addEventListener("focusout", surPerteFocus, true);
    document.addEventListener("input", surSaisie, true);
    window.visualViewport?.addEventListener("resize", surViewport);
    window.visualViewport?.addEventListener("scroll", surViewport);
    window.addEventListener("resize", surViewport);
    window.addEventListener("orientationchange", surViewport);
    window.addEventListener("super-app:clavier-hauteur", surClavierInterne);

    return () => {
      window.clearTimeout(rappel);
      if (animation) window.cancelAnimationFrame(animation);
      document.removeEventListener("focusin", surFocus, true);
      document.removeEventListener("focusout", surPerteFocus, true);
      document.removeEventListener("input", surSaisie, true);
      window.visualViewport?.removeEventListener("resize", surViewport);
      window.visualViewport?.removeEventListener("scroll", surViewport);
      window.removeEventListener("resize", surViewport);
      window.removeEventListener("orientationchange", surViewport);
      window.removeEventListener("super-app:clavier-hauteur", surClavierInterne);
    };
  }, []);

  return null;
}
