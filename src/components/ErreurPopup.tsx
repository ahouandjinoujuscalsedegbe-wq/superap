import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  ouvert: boolean;
  titre?: string;
  message: string;
  onFermer: () => void;
};

/** Pop-up d'erreur bloquant : signale une saisie invalide à reprendre. */
export function ErreurPopup({ ouvert, titre = "Action impossible", message, onFermer }: Props) {
  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={titre}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      onClick={onFermer}
    >
      <div className="carte w-full max-w-sm space-y-4 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-semibold">{titre}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onFermer}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
        >
          Reprendre
        </button>
      </div>
    </div>
  );
}
