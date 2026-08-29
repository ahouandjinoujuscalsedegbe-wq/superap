import { useEffect, useRef } from "react";

export interface PopupSaisieProps {
  ouvert: boolean;
  titre: string;
  label: string;
  valeur: string;
  placeholder?: string;
  validerLabel?: string;
  onChanger: (valeur: string) => void;
  onValider: () => void;
  onAnnuler: () => void;
}

/**
 * Pop-up de saisie : toute création ou modification de nom de catégorie ou
 * sous-catégorie passe obligatoirement par cette fenêtre.
 */
export function PopupSaisie({
  ouvert,
  titre,
  label,
  valeur,
  placeholder,
  validerLabel = "Valider",
  onChanger,
  onValider,
  onAnnuler,
}: PopupSaisieProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    function surTouche(ev: KeyboardEvent) {
      if (ev.key === "Escape") onAnnuler();
    }
    window.addEventListener("keydown", surTouche);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", surTouche);
    };
  }, [ouvert, onAnnuler]);

  if (!ouvert) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onAnnuler}
    >
      <div
        className="carte w-full max-w-sm space-y-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">{titre}</h3>
        <div className="space-y-1.5">
          <label htmlFor="popup-saisie-champ" className="text-sm font-medium">
            {label}
          </label>
          <input
            id="popup-saisie-champ"
            ref={inputRef}
            value={valeur}
            onChange={(e) => onChanger(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onValider();
            }}
            placeholder={placeholder}
            className="w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAnnuler}
            className="flex-1 rounded-xl border border-input py-3 font-medium"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onValider}
            className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
          >
            {validerLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
