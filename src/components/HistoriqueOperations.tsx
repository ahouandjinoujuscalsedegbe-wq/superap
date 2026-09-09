import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

/** Formate date et heure complètes en français (ex. 09 sept. 2026 · 06:46:12). */
function formaterDateHeure(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const heure = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date} à ${heure}`;
}

/** Historique complet (dates et heures détaillées) des revenus ou des dépenses. */
export function HistoriqueOperations({ type }: { type: "revenu" | "depense" }) {
  const { transactions } = useSuperApp();

  const lignes = useMemo(
    () => transactions.filter((t) => t.type === type).sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, type],
  );

  const total = lignes.reduce((s, t) => s + t.montant, 0);
  const estRevenu = type === "revenu";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Historique des {estRevenu ? "revenus" : "dépenses"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lignes.length} opération{lignes.length > 1 ? "s" : ""} · Total : {formatFCFA(total)}
        </p>
      </header>

      <section className="carte p-4">
        {lignes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucune opération enregistrée pour le moment.
          </p>
        ) : (
          <ul className="space-y-2">
            {lignes.map((t) => (
              <li
                key={t.id}
                className="flex items-start gap-3 rounded-xl border border-border/70 bg-secondary/40 p-3"
              >
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    estRevenu
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {estRevenu ? (
                    <ArrowDownLeft className="h-4 w-4" aria-hidden />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium break-words">{t.libelle}</span>
                  <span className="block text-xs break-words text-muted-foreground">
                    {formaterDateHeure(t.date)}
                  </span>
                  <span className="block text-xs break-words text-muted-foreground">
                    {t.categorie} · {t.compte}
                    {t.membre ? ` · ${t.membre}` : ""}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-sm font-bold ${
                    estRevenu ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {estRevenu ? "+" : "−"}
                  {formatFCFA(t.montant)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
