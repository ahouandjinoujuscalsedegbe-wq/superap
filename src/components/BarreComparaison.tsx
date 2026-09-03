import { formatFCFA } from "@/lib/format";

type StatutBudget = "bravo" | "presque" | "oups" | "parfait";

function statutBudget(prevu: number, depense: number): StatutBudget {
  if (depense > prevu) return "oups";
  if (depense === prevu) return "parfait";
  if (prevu > 0 && depense / prevu >= 0.85) return "presque";
  return "bravo";
}

const CONFIG_STATUT: Record<
  StatutBudget,
  {
    badge: string;
    couleurTexte: string;
    fond: string;
    bordure: string;
    ombre: string;
    message: (prevu: number, depense: number) => string;
  }
> = {
  bravo: {
    badge: "Bravo",
    couleurTexte: "text-budget-bonne",
    fond: "bg-budget-bonne",
    bordure: "border-budget-bonne/50",
    ombre: "0 10px 25px -8px color-mix(in oklab, var(--budget-bonne) 25%, transparent)",
    message: (prevu, depense) => `Génial ! Il te reste ${formatFCFA(prevu - depense)} à dépenser.`,
  },
  presque: {
    badge: "Presque",
    couleurTexte: "text-budget-alerte",
    fond: "bg-budget-alerte",
    bordure: "border-budget-alerte/50",
    ombre: "0 10px 25px -8px color-mix(in oklab, var(--budget-alerte) 25%, transparent)",
    message: (prevu, depense) => `Fais attention ! Il ne reste que ${formatFCFA(prevu - depense)}.`,
  },
  oups: {
    badge: "Oups",
    couleurTexte: "text-budget-depassement",
    fond: "bg-budget-depassement",
    bordure: "border-budget-depassement/50",
    ombre: "0 10px 25px -8px color-mix(in oklab, var(--budget-depassement) 25%, transparent)",
    message: (prevu, depense) => `Attention ! Tu as dépassé de ${formatFCFA(depense - prevu)}.`,
  },
  parfait: {
    badge: "Parfait",
    couleurTexte: "text-budget-bonne",
    fond: "bg-budget-bonne",
    bordure: "border-budget-bonne/50",
    ombre: "0 10px 25px -8px color-mix(in oklab, var(--budget-bonne) 25%, transparent)",
    message: () => "Tu as dépensé exactement ce qui était prévu.",
  },
};

/**
 * Carte visuelle « prévu / dépensé » avec couleurs ludiques.
 * Le statut est immédiatement identifiable grâce à un badge, une barre
 * colorée et une phrase simple.
 */
export function CarteComparaison({
  titre,
  prevu,
  depense,
}: {
  titre?: string;
  prevu: number;
  depense: number;
}) {
  const statut = statutBudget(prevu, depense);
  const config = CONFIG_STATUT[statut];
  const ratio = prevu > 0 ? Math.min(depense / prevu, 1) : 0;
  const largeur = Math.round(ratio * 100);

  return (
    <div
      className={`space-y-4 rounded-3xl border-4 p-5 shadow-xl transition-transform active:scale-[0.99] ${config.bordure}`}
      style={{
        backgroundColor:
          "color-mix(in oklab, var(--card) calc(var(--surface-alpha) * 100%), transparent)",
        boxShadow: config.ombre,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {titre ? (
          <h3 className="min-w-0 truncate text-lg font-semibold tracking-tight text-foreground">
            {titre}
          </h3>
        ) : (
          <div />
        )}
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide italic ${config.fond} ${statut === "presque" ? "text-budget-alerte-foreground" : statut === "oups" ? "text-budget-depassement-foreground" : "text-budget-bonne-foreground"}`}
        >
          {config.badge}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm font-semibold text-muted-foreground">
          <span>Dépensé : {formatFCFA(depense)}</span>
          <span>Prévu : {formatFCFA(prevu)}</span>
        </div>

        <div className="relative h-8 w-full overflow-hidden rounded-full bg-muted">
          {statut === "oups" && (
            <div
              className="absolute top-0 bottom-0 z-10 w-0.5 bg-foreground"
              style={{
                left: `${prevu > 0 ? Math.min((prevu / Math.max(prevu, depense, 1)) * 100, 100) : 0}%`,
              }}
            />
          )}
          <div
            className={`h-full rounded-full transition-all duration-500 ${config.fond}`}
            style={{ width: `${largeur}%` }}
          />
        </div>
      </div>

      <p className={`rounded-2xl p-3 text-center text-sm font-bold ${config.couleurTexte}`}>
        {config.message(prevu, depense)}
      </p>
    </div>
  );
}

/**
 * Comparaison compacte « prévu » / « dépensé » sous forme de deux barres
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
  const statut = statutBudget(prevu, depense);

  const couleurDepense =
    statut === "oups"
      ? "bg-budget-depassement"
      : statut === "presque"
        ? "bg-budget-alerte"
        : "bg-budget-bonne";

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
            className={`h-full rounded-full ${couleurDepense}`}
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
