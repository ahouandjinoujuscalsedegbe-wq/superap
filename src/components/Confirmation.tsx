import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export interface ConfirmationProps {
  ouvert: boolean;
  titre: string;
  message: string;
  confirmerLabel?: string;
  danger?: boolean;
  onConfirmer: () => void;
  onAnnuler: () => void;
}

/**
 * Fenêtre pop-up de confirmation obligatoire avant toute création,
 * modification ou suppression, pour éviter les erreurs de manipulation.
 */
export function Confirmation({
  ouvert,
  titre,
  message,
  confirmerLabel = "Confirmer",
  danger = false,
  onConfirmer,
  onAnnuler,
}: ConfirmationProps) {
  useEffect(() => {
    if (!ouvert) return;
    function surTouche(ev: KeyboardEvent) {
      if (ev.key === "Escape") onAnnuler();
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert, onAnnuler]);

  if (!ouvert) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={titre}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={onAnnuler}
    >
      <div
        className="carte w-full max-w-sm space-y-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            }`}
          >
            <AlertTriangle aria-hidden className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{titre}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
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
            onClick={onConfirmer}
            className={`flex-1 rounded-xl py-3 font-semibold ${
              danger
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {confirmerLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
