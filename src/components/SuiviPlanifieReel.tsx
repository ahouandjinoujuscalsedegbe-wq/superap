import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, PlusCircle } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { useSuperApp } from "@/lib/store";
import { decalerMois } from "@/lib/budget-mensuel";
import { comparerPlanifieEtReel, depensesDuMois, echeancesDuMois } from "@/lib/suivi-planifie";

function moisLisible(mois: string): string {
  return new Date(`${mois}-01T12:00:00`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

function jourLisible(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Suivi du planifié face au réel : pour le mois choisi, les dépenses
 * planifiées de la Budgétisation sont confrontées aux dépenses réellement
 * saisies, avec leur enveloppe et leur date. Tout est calculé sur l'appareil.
 */
export function SuiviPlanifieReel() {
  const { budgets, transactions, enveloppes } = useSuperApp();
  const moisActuel = new Date().toISOString().slice(0, 7);
  const [mois, setMois] = useState(moisActuel);

  const choixMois = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((i) => decalerMois(moisActuel, -i)),
    [moisActuel],
  );
  const planifiees = useMemo(() => echeancesDuMois(budgets, mois), [budgets, mois]);
  const reelles = useMemo(
    () => depensesDuMois(transactions, enveloppes, mois),
    [transactions, enveloppes, mois],
  );
  const comparaison = useMemo(
    () => comparerPlanifieEtReel(budgets, transactions, enveloppes, mois),
    [budgets, transactions, enveloppes, mois],
  );

  const totalPlanifie = planifiees.reduce((s, l) => s + l.budget.montant, 0);
  const totalReel = reelles.reduce((s, d) => s + d.transaction.montant, 0);
  const ecart = totalReel - totalPlanifie;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {choixMois.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMois(m)}
            aria-pressed={m === mois}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              m === mois ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {moisLisible(m)}
          </button>
        ))}
      </div>

      <section className="carte grid grid-cols-3 gap-2 p-4 text-center">
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Planifié</p>
          <p className="text-sm font-bold">{formatFCFA(totalPlanifie)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Réel saisi</p>
          <p className="text-sm font-bold">{formatFCFA(totalReel)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Écart</p>
          <p
            className={`text-sm font-bold ${ecart > 0 ? "text-destructive" : "text-emerald-600"}`}
          >
            {ecart > 0 ? "+" : ""}
            {formatFCFA(ecart)}
          </p>
        </div>
      </section>

      <Link
        to="/depense"
        className="carte flex items-center gap-3 p-4 text-sm font-semibold active:scale-[0.99]"
      >
        <PlusCircle className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        Saisir une dépense réelle
      </Link>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
          Planifié / réel par enveloppe
        </h2>
        {comparaison.length === 0 ? (
          <p className="carte p-4 text-sm text-muted-foreground">
            Rien de planifié ni de dépensé sur {moisLisible(mois)}.
          </p>
        ) : (
          comparaison.map((c) => (
            <article key={c.nom} className="carte space-y-1 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold">
                  <span aria-hidden>{c.emoji}</span> {c.nom}
                </p>
                <span
                  className={`shrink-0 text-xs font-semibold ${
                    c.ecart > 0 ? "text-destructive" : "text-emerald-600"
                  }`}
                >
                  {c.ecart > 0 ? "+" : ""}
                  {formatFCFA(c.ecart)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Planifié {formatFCFA(c.planifie)} — réel {formatFCFA(c.reel)}
              </p>
            </article>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
          Dépenses réelles de {moisLisible(mois)}
        </h2>
        {reelles.length === 0 ? (
          <p className="carte p-4 text-sm text-muted-foreground">
            Aucune dépense saisie sur ce mois.
          </p>
        ) : (
          <ul className="space-y-2">
            {reelles.map((d) => (
              <li key={d.transaction.id} className="carte flex items-center gap-3 p-3">
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.transaction.libelle}</p>
                  <p className="text-xs text-muted-foreground">
                    {jourLisible(d.transaction.date)} · {d.enveloppe?.nom ?? "Sans enveloppe"} ·{" "}
                    {moisLisible(mois)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold">
                  {formatFCFA(d.transaction.montant)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
          Dépenses planifiées de {moisLisible(mois)}
        </h2>
        {planifiees.length === 0 ? (
          <p className="carte p-4 text-sm text-muted-foreground">
            Aucune dépense planifiée sur ce mois.
          </p>
        ) : (
          <ul className="space-y-2">
            {planifiees.map((l, i) => {
              const env = enveloppes.find((e) => e.id === l.budget.enveloppeId);
              return (
                <li key={`${l.budget.id}-${l.date}-${i}`} className="carte flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.budget.libelle}</p>
                    <p className="text-xs text-muted-foreground">
                      {jourLisible(l.date)} · {env?.nom ?? "Sans enveloppe"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">
                    {formatFCFA(l.budget.montant)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
