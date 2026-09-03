import { formatFCFA } from "@/lib/format";

/**
 * Comparaison visuelle « prévu » / « dépensé » sous forme de deux barres
 * de longueurs proportionnelles, avec un langage très simple.
 */
export function BarreComparaison({
  prevu,
  depense,
  compact = false,
}: {
  prevu: number;
  depense: number;
  compact?: boolean;
}) {
  const maximum = Math.max(prevu, depense, 1);
  const largeurPrevu = Math.round((prevu / maximum) * 100);
  const largeurDepense = Math.round((depense / maximum) * 100);
  const trop = depense > prevu;

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            <span aria-hidden>📝</span> Prévu
          </span>
          <span className="text-xs font-bold">{formatFCFA(prevu)}</span>
        </div>
        <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-muted-foreground/50"
            style={{ width: `${largeurPrevu}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            <span aria-hidden>💸</span> Dépensé
          </span>
          <span className="text-xs font-bold">{formatFCFA(depense)}</span>
        </div>
        <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${trop ? "bg-destructive" : "bg-emerald-500"}`}
            style={{ width: `${largeurDepense}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Phrase courte expliquant l'écart, compréhensible par un enfant. */
export function phraseEcart(prevu: number, depense: number): string {
  const ecart = depense - prevu;
  if (ecart > 0) return `${formatFCFA(ecart)} de trop`;
  if (ecart === 0) return "pile ce qui était prévu";
  return `${formatFCFA(-ecart)} en moins, c'est bien`;
}
