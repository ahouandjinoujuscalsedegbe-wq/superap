import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowBigUp, Check, Delete, X } from "lucide-react";

/**
 * Clavier interne à l'application.
 *
 * Il s'active automatiquement dès qu'un champ de saisie reçoit le focus et
 * empêche l'ouverture du clavier natif du téléphone (inputMode="none").
 * Ajoutez `data-clavier="off"` sur un champ pour le laisser au clavier système.
 */

type Mode = "texte" | "numerique";

const LIGNES_TEXTE = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
  ["w", "x", "c", "v", "b", "n", "'", "-"],
];
const ACCENTS = ["é", "è", "ê", "à", "ç", "ù", "ô", "î"];
const TOUCHES_NUM = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"];

type Champ = HTMLInputElement | HTMLTextAreaElement;

function estChampTexte(el: Element | null): el is Champ {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  const type = (el as HTMLInputElement).type;
  return ["text", "number", "search", "tel", "email", "url", "password"].includes(type);
}

/** Écrit une valeur dans un champ contrôlé par React. */
function ecrire(champ: Champ, valeur: string) {
  const proto =
    champ.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(champ, valeur);
  champ.dispatchEvent(new Event("input", { bubbles: true }));
}

export function ClavierInterne() {
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<Mode>("texte");
  const [majuscule, setMajuscule] = useState(false);
  const [decimale, setDecimale] = useState(false);
  const [numeriqueForce, setNumeriqueForce] = useState(false);
  const champRef = useRef<Champ | null>(null);
  const clavierRef = useRef<HTMLDivElement | null>(null);

  const fermer = useCallback(() => {
    setOuvert(false);
    champRef.current = null;
    setDecimale(false);
    setNumeriqueForce(false);
  }, []);

  // Quand le clavier est ouvert : réserve de l'espace en bas de page et
  // remonte le champ actif juste au-dessus du clavier pour qu'il reste visible.
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
      // On n'écrit le style que s'il change réellement : sinon le
      // redimensionnement se redéclenche en boucle et fige l'application.
      if (padding !== dernierPadding) {
        dernierPadding = padding;
        document.body.style.paddingBottom = padding;
      }

      const rect = champ.getBoundingClientRect();
      const limiteVisible = window.innerHeight - hauteurClavier - 12;
      if (rect.bottom > limiteVisible + 2 || rect.top < -2) {
        const decalage = rect.bottom - limiteVisible;
        window.scrollBy({ top: Math.max(decalage, rect.top - 12), behavior: "auto" });
      }
    };

    // Une seule mise à jour par image : évite toute boucle infinie.
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
    };
  }, [ouvert, mode]);


  useEffect(() => {
    const onFocus = (ev: FocusEvent) => {
      const cible = ev.target as Element | null;
      if (!estChampTexte(cible)) return;
      if (cible.dataset["clavier"] === "off" || cible.readOnly || cible.disabled) return;

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
      setDecimale(
        (cible as HTMLInputElement).type === "number" || modeOrigine === "decimal",
      );
      setMode(numerique ? "numerique" : "texte");
      setNumeriqueForce(numerique);
      setMajuscule(false);
      setOuvert(true);
    };
    const onFocusOut = (ev: FocusEvent) => {
      const suivant = ev.relatedTarget as Element | null;
      if (suivant && suivant.closest?.("[data-clavier-interne]")) return;
      if (!estChampTexte(suivant)) window.setTimeout(() => {
        if (!estChampTexte(document.activeElement)) fermer();
      }, 60);
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [fermer]);

  const taper = (touche: string) => {
    const champ = champRef.current;
    if (!champ) return;
    let valeur = champ.value ?? "";
    let ajout = touche;
    if (mode === "numerique") {
      // Champ numérique : chiffres uniquement, point décimal seulement si autorisé.
      if (ajout === ".") {
        if (!decimale || valeur.includes(".")) return;
      } else if (!/^\d$/.test(ajout)) {
        return;
      }
    } else {
      ajout = ajout.toLocaleUpperCase("fr-FR");
    }
    ecrire(champ, valeur + ajout);
    if (majuscule) setMajuscule(false);
  };

  const effacer = () => {
    const champ = champRef.current;
    if (!champ) return;
    ecrire(champ, (champ.value ?? "").slice(0, -1));
  };

  const valider = () => {
    const champ = champRef.current;
    champ?.blur();
    fermer();
  };

  if (!ouvert) return null;

  return (
    <div
      ref={clavierRef}
      data-clavier-interne
      onPointerDown={(e) => e.preventDefault()}
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-card/98 p-2 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur"
      role="group"
      aria-label="Clavier interne de l'application"
    >
      <div className="mx-auto max-w-md space-y-1.5">
        <div className="flex items-center justify-between px-1 pb-0.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Clavier de l’application
          </span>
          <div className="flex items-center gap-1">
            {!numeriqueForce && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setMode(mode === "texte" ? "numerique" : "texte");
                }}
                className="rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold"
              >
                {mode === "texte" ? "123" : "ABC"}
              </button>
            )}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                valider();
              }}
              aria-label="Fermer le clavier"
              className="rounded-md bg-secondary p-1"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </div>

        {mode === "numerique" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {TOUCHES_NUM.filter((t) => t !== "." || decimale).map((t) => (
              <Touche key={t} onClick={() => taper(t)} label={t} />
            ))}
            <Touche onClick={effacer} label={<Delete aria-hidden className="h-5 w-5" />} />
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                valider();
              }}
              className="col-span-3 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Check aria-hidden className="h-4 w-4" /> Valider
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex justify-center gap-1">
              {ACCENTS.map((t) => (
                <Touche key={t} onClick={() => taper(t)} label={t} petite />
              ))}
            </div>
            {LIGNES_TEXTE.map((ligne, i) => (
              <div key={i} className="flex justify-center gap-1">
                {i === 3 && (
                  <Touche
                    onClick={() => setMajuscule((m) => !m)}
                    label={<ArrowBigUp aria-hidden className="h-4 w-4" />}
                    actif={majuscule}
                    petite
                  />
                )}
                {ligne.map((t) => (
                  <Touche
                    key={t}
                    onClick={() => taper(t)}
                    label={majuscule ? t.toUpperCase() : t}
                    petite
                  />
                ))}
                {i === 3 && (
                  <Touche
                    onClick={effacer}
                    label={<Delete aria-hidden className="h-4 w-4" />}
                    petite
                  />
                )}
              </div>
            ))}
            <div className="flex gap-1.5">
              <Touche onClick={() => taper(" ")} label="espace" pleine />
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  valider();
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <Check aria-hidden className="h-4 w-4" /> OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Touche({
  label,
  onClick,
  petite,
  pleine,
  actif,
}: {
  label: React.ReactNode;
  onClick: () => void;
  petite?: boolean;
  pleine?: boolean;
  actif?: boolean;
}) {
  return (
    <button
      type="button"
      // Sur téléphone, on déclenche la touche dès l'appui : le WebView Android
      // n'envoie pas toujours l'événement « click » quand le focus reste au champ.
      onPointerDown={(event) => {
        event.preventDefault();
        onClick();
      }}
      style={{ touchAction: "manipulation" }}
      className={`flex select-none items-center justify-center rounded-lg border border-border/60 font-medium transition-colors active:bg-primary/20 ${
        actif ? "bg-primary/20" : "bg-secondary"
      } ${pleine ? "flex-1 py-2.5 text-sm" : petite ? "min-w-8 flex-1 py-2.5 text-sm" : "py-3 text-base"}`}
    >
      {label}
    </button>
  );
}
