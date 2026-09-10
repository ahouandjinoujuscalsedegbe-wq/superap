/**
 * Alerte visible quand une ou plusieurs enveloppes dépassent leur budget.
 * Utilisée dans le tableau de bord et dans la page de dépense.
 */
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { etatEnveloppe } from "@/lib/enveloppe-etat";
import { formatFCFA } from "@/lib/format";

export type AlerteEnveloppe = {
  id: string;
  nom: string;
  emoji: string;
  /** Montant dépensé au-delà du plafond. */
  depassement: number;
  epuisee: boolean;
  reserveDisponible: number;
};

export function useAlertesEnveloppes(): AlerteEnveloppe[] {
  const { enveloppes, depensesParEnveloppe } = useSuperApp();
  return useMemo(() => {
    const liste: AlerteEnveloppe[] = [];
    for (const e of enveloppes) {
      const utilise = depensesParEnveloppe[e.id] ?? 0;
      const etat = etatEnveloppe(e, utilise);
      if (!etat.plafondAtteint) continue;
      liste.push({
        id: e.id,
        nom: e.nom,
        emoji: e.emoji,
        depassement: Math.max(0, utilise - e.plafond),
        epuisee: etat.epuisee,
        reserveDisponible: etat.reserveDisponible,
      });
    }
    return liste.sort((a, b) => b.depassement - a.depassement);
  }, [enveloppes, depensesParEnveloppe]);
}

/** Encart d'alerte ; ne s'affiche que si au moins une enveloppe dépasse son budget. */
export default function AlerteEnveloppes({ compact = false }: { compact?: boolean }) {
  const alertes = useAlertesEnveloppes();
  if (alertes.length === 0) return null;

  return (
    <section
      role="alert"
      className="carte space-y-2 border-destructive/50 bg-destructive/10 p-4"
      aria-label="Enveloppes qui dépassent leur budget"
    >
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {alertes.length === 1
          ? "1 enveloppe dépasse son budget"
          : `${alertes.length} enveloppes dépassent leur budget`}
      </h2>
      <ul className="space-y-1.5 text-sm">
        {alertes.slice(0, compact ? 3 : alertes.length).map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-2">
            <Link to="/enveloppes/details" className="min-w-0 truncate underline-offset-2">
              <span aria-hidden>{a.emoji}</span> {a.nom}
              <span className="block text-xs text-muted-foreground">
                {a.epuisee
                  ? "Épuisée : plus rien de disponible, même en réserve."
                  : `Réserve restante : ${formatFCFA(a.reserveDisponible)}`}
              </span>
            </Link>
            <span className="shrink-0 text-xs font-semibold text-destructive">
              +{formatFCFA(a.depassement)}
            </span>
          </li>
        ))}
      </ul>
      {compact && alertes.length > 3 && (
        <p className="text-xs text-muted-foreground">
          et {alertes.length - 3} autre(s) enveloppe(s) concernée(s).
        </p>
      )}
    </section>
  );
}
