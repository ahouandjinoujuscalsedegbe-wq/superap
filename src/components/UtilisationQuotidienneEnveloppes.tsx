import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { useSuperApp } from "@/lib/store";
import {
  construireRapportMois,
  libelleMois,
  lireArchives,
  moisCourant,
} from "@/lib/rapport-enveloppes";

/**
 * Relevé jour par jour de chaque enveloppe pour un mois donné.
 * Les mois écoulés sont lus dans le classement figé avant renouvellement ;
 * le mois en cours est recalculé en direct.
 */
export function UtilisationQuotidienneEnveloppes({ mois }: { mois: string }) {
  const { enveloppes, transactions, remplissages } = useSuperApp();
  const [ouverte, setOuverte] = useState<string | null>(null);

  const rapport = useMemo(() => {
    const archive = lireArchives()[mois];
    if (archive && mois !== moisCourant()) return archive;
    return construireRapportMois(mois, enveloppes, transactions, remplissages);
  }, [mois, enveloppes, transactions, remplissages]);

  return (
    <section className="space-y-3">
      <header className="flex items-start gap-3">
        <span className="rounded-2xl bg-primary/10 p-2 text-primary">
          <CalendarDays className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight">Utilisation quotidienne</h2>
          <p className="text-xs text-muted-foreground">
            Relevé jour par jour de chaque enveloppe pour {libelleMois(mois)}.
          </p>
        </div>
      </header>

      <div className="carte grid grid-cols-2 gap-3 p-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total versé</p>
          <p className="text-lg font-bold text-primary">{formatFCFA(rapport.totalVerse)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total dépensé</p>
          <p className="text-lg font-bold">{formatFCFA(rapport.totalDepense)}</p>
        </div>
      </div>

      {rapport.enveloppes.length === 0 ? (
        <p className="carte p-4 text-sm text-muted-foreground">
          Aucun mouvement d'enveloppe pour {libelleMois(mois)}.
        </p>
      ) : (
        <ul className="space-y-2">
          {rapport.enveloppes.map((r) => {
            const ouvert = ouverte === r.enveloppeId;
            const joursUtiles = r.jours.filter((j) => j.depense > 0);
            return (
              <li key={r.enveloppeId} className="carte overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOuverte(ouvert ? null : r.enveloppeId)}
                  aria-expanded={ouvert}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left"
                >
                  <span className="text-lg" aria-hidden>
                    {r.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.nom}</span>
                    <span className="block text-xs text-muted-foreground">
                      Versé {formatFCFA(r.verse)} · Dépensé {formatFCFA(r.depense)} ·{" "}
                      {r.joursActifs} jour(s) d'utilisation
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${ouvert ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>

                {ouvert && (
                  <div className="border-t border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Moyenne {formatFCFA(r.moyenneJour)} par jour · Reste {formatFCFA(r.reste)}
                      {r.jourFort ? ` · Journée la plus forte : ${r.jourFort.slice(8)}` : ""}
                    </p>

                    {joursUtiles.length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Aucune dépense enregistrée ce mois-ci.
                      </p>
                    ) : (
                      <table className="mt-2 w-full text-xs">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="py-1 text-left font-medium">Jour</th>
                            <th className="py-1 text-right font-medium">Dépense</th>
                            <th className="py-1 text-right font-medium">Cumul</th>
                            <th className="py-1 text-right font-medium">Reste</th>
                          </tr>
                        </thead>
                        <tbody>
                          {joursUtiles.map((j) => (
                            <tr key={j.date} className="border-t border-border/60">
                              <td className="py-1">
                                {String(j.jour).padStart(2, "0")}
                                {j.operations > 1 ? ` (${j.operations})` : ""}
                              </td>
                              <td className="py-1 text-right font-semibold">
                                {formatFCFA(j.depense)}
                              </td>
                              <td className="py-1 text-right">{formatFCFA(j.cumul)}</td>
                              <td
                                className={`py-1 text-right ${j.reste < 0 ? "text-destructive" : ""}`}
                              >
                                {formatFCFA(j.reste)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
