import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { previsionFinDeMois } from "@/lib/ia-avancee";

const COULEURS = {
  ok: "border-success/40 bg-success/10",
  juste: "border-amber-400/50 bg-amber-400/10",
  depassement: "border-destructive/40 bg-destructive/10",
} as const;

/**
 * Prévision de fin de mois, enveloppe par enveloppe : l'application
 * prolonge votre rythme actuel jusqu'au dernier jour du mois.
 */
export function PrevisionEnveloppes({ limite = 4 }: { limite?: number }) {
  const { enveloppes, depensesParEnveloppe } = useSuperApp();

  const previsions = useMemo(
    () => previsionFinDeMois({ enveloppes, depensesParEnveloppe }).slice(0, limite),
    [enveloppes, depensesParEnveloppe, limite],
  );

  if (previsions.length === 0) return null;

  return (
    <section className="carte space-y-2 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
        Prévision de fin de mois
      </h2>
      <ul className="space-y-2">
        {previsions.map((p) => (
          <li key={p.id} className={`rounded-xl border p-3 text-xs ${COULEURS[p.niveau]}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{p.nom}</span>
              <span className="shrink-0 font-semibold">{formatFCFA(p.projete)}</span>
            </div>
            <p className="mt-0.5 text-muted-foreground">{p.phrase}</p>
            <p className="text-muted-foreground">
              Déjà dépensé {formatFCFA(p.depense)} sur {formatFCFA(p.dotation)}
              {p.jourEpuisement ? ` · vide vers le ${p.jourEpuisement} du mois` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
