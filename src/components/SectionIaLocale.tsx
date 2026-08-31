import { useMemo } from "react";
import { BrainCircuit, Gauge, Layers, TrendingDown, TrendingUp } from "lucide-react";
import {
  budgetsRecommandes,
  detecterDerives,
  previsionTresorerie,
  risqueDecouvert,
  segmenterDepenses,
} from "@/lib/ia-locale";
import { formatDateFr, formatFCFA } from "@/lib/format";
import type { Enveloppe, Transaction } from "@/lib/store";

type Props = {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  solde: number;
};

/**
 * Tableau de bord des intelligences locales : prévision de trésorerie,
 * risque de découvert, profil de dépenses, dérives et budgets conseillés.
 * Tout est calculé sur l'appareil, sans aucune connexion.
 */
export function SectionIaLocale({ transactions, enveloppes, solde }: Props) {
  const prevision = useMemo(
    () => previsionTresorerie(transactions, solde, 30),
    [transactions, solde],
  );
  const risque = useMemo(() => risqueDecouvert(transactions, solde, 30), [transactions, solde]);
  const segments = useMemo(() => segmenterDepenses(transactions), [transactions]);
  const derives = useMemo(() => detecterDerives(transactions), [transactions]);
  const budgets = useMemo(
    () => budgetsRecommandes(enveloppes, transactions),
    [enveloppes, transactions],
  );

  const fin = prevision.at(-1);
  const couleurRisque =
    risque.niveau === "alerte"
      ? "text-destructive"
      : risque.niveau === "attention"
        ? "text-warning"
        : "text-success";

  return (
    <section className="carte space-y-4 p-4">
      <header className="space-y-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <BrainCircuit className="h-4 w-4 text-primary" aria-hidden />
          Intelligence locale
        </h2>
        <p className="text-xs text-muted-foreground">
          Modèles calculés sur votre téléphone : aucune donnée n'est envoyée.
        </p>
      </header>

      {/* Prévision de trésorerie sur 30 jours */}
      {fin && (
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-semibold">Prévision de trésorerie (30 jours)</p>
          <p className="mt-1 text-lg font-bold">{formatFCFA(fin.solde)}</p>
          <p className="text-xs text-muted-foreground">
            Solde estimé au {formatDateFr(fin.date)}, tendance et habitudes de la semaine incluses.
          </p>
        </div>
      )}

      {/* Risque de découvert */}
      <div className="rounded-lg bg-muted/50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <Gauge className="h-3.5 w-3.5" aria-hidden />
          Risque de découvert
        </p>
        <p className={`mt-1 text-lg font-bold ${couleurRisque}`}>{risque.probabilite} %</p>
        <p className="text-xs text-muted-foreground">
          {risque.jourMedian
            ? `Découvert possible vers le jour ${risque.jourMedian}. Solde médian simulé : ${formatFCFA(risque.soldeMedian)}.`
            : `Aucun découvert probable sur 30 jours. Solde médian simulé : ${formatFCFA(risque.soldeMedian)}.`}
        </p>
      </div>

      {/* Profil de dépenses */}
      {segments.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            Profil de vos dépenses
          </p>
          <ul className="space-y-1 text-sm">
            {segments.map((s) => (
              <li key={s.nom} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {s.nom} · {s.operations} op. · ~{formatFCFA(s.centre)}
                </span>
                <span className="shrink-0 font-semibold">{s.part} %</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dérives détectées */}
      {derives.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold">Postes qui dérivent</p>
          <ul className="space-y-1 text-sm">
            {derives.slice(0, 4).map((d) => (
              <li key={d.categorie} className="flex items-center justify-between gap-2">
                <span className="truncate">{d.categorie}</span>
                <span
                  className={`flex shrink-0 items-center gap-1 font-semibold ${
                    d.sens === "hausse" ? "text-destructive" : "text-success"
                  }`}
                >
                  {d.sens === "hausse" ? (
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {d.variation > 0 ? "+" : ""}
                  {d.variation} %
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Budgets recommandés */}
      {budgets.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold">Plafonds conseillés</p>
          <ul className="space-y-1 text-sm">
            {budgets
              .filter((b) => b.conseil !== "garder")
              .slice(0, 4)
              .map((b) => (
                <li key={b.enveloppe.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {b.enveloppe.emoji} {b.enveloppe.nom}
                  </span>
                  <span className="shrink-0 text-xs">
                    {formatFCFA(b.plafondActuel)} →{" "}
                    <strong className="font-semibold">{formatFCFA(b.plafondConseille)}</strong>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
