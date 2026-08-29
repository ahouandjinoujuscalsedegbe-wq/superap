import { useEffect } from "react";

/**
 * Force toutes les saisies de l'application en MAJUSCULES,
 * quel que soit le champ (input texte ou zone de texte).
 */

const TYPES_TEXTE = ["text", "search", "tel", "url", "email", "password"];

type Champ = HTMLInputElement | HTMLTextAreaElement;

function estChampTexte(el: EventTarget | null): el is Champ {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  return TYPES_TEXTE.includes((el as HTMLInputElement).type);
}

function ecrire(champ: Champ, valeur: string) {
  const proto =
    champ.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(champ, valeur);
  champ.dispatchEvent(new Event("input", { bubbles: true }));
}

export function MajusculesPartout() {
  useEffect(() => {
    const surSaisie = (ev: Event) => {
      const champ = ev.target;
      if (!estChampTexte(champ)) return;
      // Champs techniques (colis chiffré, sauvegardes) : contenu sensible à la casse.
      if (champ.dataset["majuscules"] === "non") return;
      const valeur = champ.value ?? "";
      const majuscules = valeur.toLocaleUpperCase("fr-FR");
      if (valeur === majuscules) return;

      const debut = champ.selectionStart;
      const fin = champ.selectionEnd;
      ecrire(champ, majuscules);
      try {
        if (debut !== null && fin !== null) champ.setSelectionRange(debut, fin);
      } catch {
        /* certains types de champs n'acceptent pas la sélection */
      }
    };

    document.addEventListener("input", surSaisie, true);
    return () => document.removeEventListener("input", surSaisie, true);
  }, []);

  return null;
}
