import { useMemo } from "react";
import { AlertTriangle, Brain, CalendarClock, Sparkles } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { operationsInhabituelles, resumeHebdomadaire, rythmesDepenses } from "@/lib/ia-avancee";

/**
 * Ce que l'application a appris de vos habitudes : rythmes repérés,
 * dépenses inhabituelles et résumé de la semaine. Tout est calculé
 * sur l'appareil, à partir de vos propres saisies.
 */
export function CarteIaApprentissage() {
  const { transactions, enveloppes, depensesParEnveloppe } = useSuperApp();

  const rythmes = useMemo(() => rythmesDepenses(transactions), [transactions]);
  const inhabituelles = useMemo(() => operationsInhabituelles(transactions), [transactions]);
  const hebdo = useMemo(
    () => resumeHebdomadaire({ transactions, enveloppes, depensesParEnveloppe }),
    [transactions, enveloppes, depensesParEnveloppe],
  );

  return (
    <section className="carte space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Brain className="h-4 w-4 text-primary" aria-hidden />
        Ce que l'application a appris de vous
      </h2>

      <div className="rounded-xl bg-muted/40 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Résumé de la semaine
        </p>
        <p className="mt-1 text-sm">
          {formatFCFA(hebdo.depensesSemaine)} dépensés{" "}
          {hebdo.variation !== 0 && (
            <span className={hebdo.variation > 0 ? "text-destructive" : "text-success"}>
              ({hebdo.variation > 0 ? "+" : ""}
              {hebdo.variation} % par rapport à la semaine passée)
            </span>
          )}
        </p>
        <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
          <li>✅ {hebdo.meilleurPoint}</li>
          <li>⚠️ {hebdo.pointDeVigilance}</li>
          <li className="text-foreground">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" aria-hidden />
            {hebdo.actionConseillee}
          </li>
        </ul>
      </div>

      {rythmes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">Vos habitudes repérées</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {rythmes.map((r) => (
              <li key={`${r.libelle}-${r.jour}`}>• {r.phrase}</li>
            ))}
          </ul>
        </div>
      )}

      {inhabituelles.length > 0 && (
        <div className="space-y-1 rounded-xl border border-destructive/30 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Dépenses inhabituelles
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {inhabituelles.map((o) => (
              <li key={o.id}>
                • {o.phrase} <span className="text-destructive">(+{o.ecartPourcent} %)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
