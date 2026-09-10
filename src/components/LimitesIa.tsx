import { useMemo } from "react";
import { ShieldAlert } from "lucide-react";
import { detecterLimites } from "@/lib/limites-ia";
import type { EtatIA } from "@/lib/ia-unifiee";

/**
 * Ce que l'intelligence de l'application ne sait pas faire aujourd'hui :
 * fiabilité estimée, limites détectées et limites définitives.
 */
export function LimitesIa({ etat }: { etat: EtatIA }) {
  const bilan = useMemo(() => detecterLimites(etat), [etat]);

  const couleur =
    bilan.fiabilite >= 80
      ? "text-success"
      : bilan.fiabilite >= 50
        ? "text-warning"
        : "text-destructive";

  return (
    <section className="carte space-y-2 p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ShieldAlert className="h-4 w-4 text-primary" aria-hidden />
        Mes limites aujourd'hui
      </h3>

      <p className={`text-lg font-bold ${couleur}`}>Fiabilité estimée : {bilan.fiabilite} %</p>
      <p className="text-xs text-muted-foreground">{bilan.avertissement}</p>

      <ul className="space-y-1.5 text-xs">
        {bilan.limites.map((l) => (
          <li key={l.id} className="rounded-lg border border-border/70 p-2">
            <p className="font-semibold">
              <span aria-hidden>{l.gravite === "bloquante" ? "⛔" : "⚠️"}</span> {l.titre}
            </p>
            <p className="text-muted-foreground">
              {l.domaine} · {l.detail}
            </p>
          </li>
        ))}
      </ul>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold">Ce que je ne saurai jamais faire</summary>
        <ul className="mt-1 space-y-1">
          {bilan.horsPortee.map((h) => (
            <li key={h}>• {h}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
