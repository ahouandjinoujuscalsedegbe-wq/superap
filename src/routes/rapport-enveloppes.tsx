import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";
import { formatFCFA } from "@/lib/format";
import { useSuperApp } from "@/lib/store";
import {
  construireRapportMois,
  libelleMois,
  lireArchives,
  moisCourant,
  moisDisponibles,
} from "@/lib/rapport-enveloppes";

export const Route = createFileRoute("/rapport-enveloppes")({
  head: () => ({
    meta: [
      { title: "Utilisation quotidienne des enveloppes — SUPER APP" },
      {
        name: "description",
        content:
          "Relevé jour par jour de chaque enveloppe : montant versé, dépenses quotidiennes, cumul et reste, mois par mois, en FCFA.",
      },
      { property: "og:title", content: "Utilisation quotidienne des enveloppes — SUPER APP" },
      {
        property: "og:description",
        content:
          "Rapport classé, jour par jour, de l'utilisation de chaque enveloppe avant chaque renouvellement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RapportEnveloppes,
});

function RapportEnveloppes() {
  const { enveloppes, transactions, remplissages } = useSuperApp();
  const [mois, setMois] = useState(() => moisCourant());
  const [ouverte, setOuverte] = useState<string | null>(null);

  const listeMois = useMemo(
    () => moisDisponibles(transactions, remplissages),
    [transactions, remplissages],
  );

  // Les mois écoulés sont lus dans le classement figé avant renouvellement ;
  // le mois en cours est recalculé en direct.
  const rapport = useMemo(() => {
    const archives = lireArchives();
    const archive = archives[mois];
    if (archive && mois !== moisCourant()) return archive;
    return construireRapportMois(mois, enveloppes, transactions, remplissages);
  }, [mois, enveloppes, transactions, remplissages]);

  return (
    <div className="space-y-4 pb-28 pt-3">
      <BoutonRetour to="/" label="Retour à l'accueil" />

      <header className="flex items-start gap-3">
        <span className="rounded-2xl bg-primary/10 p-2 text-primary">
          <CalendarDays className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Utilisation quotidienne</h1>
          <p className="text-xs text-muted-foreground">
            Relevé jour par jour de chaque enveloppe, classé avant chaque renouvellement du 1er du
            mois.
          </p>
        </div>
      </header>

      <label className="block text-xs font-medium text-muted-foreground">
        Mois du rapport
        <select
          value={mois}
          onChange={(e) => {
            setMois(e.target.value);
            setOuverte(null);
          }}
          className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground"
        >
          {listeMois.map((m) => (
            <option key={m} value={m}>
              {libelleMois(m)}
              {m === moisCourant() ? " (en cours)" : ""}
            </option>
          ))}
        </select>
      </label>

      <section className="carte grid grid-cols-2 gap-3 p-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total versé</p>
          <p className="text-lg font-bold text-primary">{formatFCFA(rapport.totalVerse)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total dépensé</p>
          <p className="text-lg font-bold">{formatFCFA(rapport.totalDepense)}</p>
        </div>
      </section>

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
    </div>
  );
}
