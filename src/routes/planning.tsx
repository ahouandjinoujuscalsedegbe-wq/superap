import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, TrendingDown, TrendingUp } from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { construirePlanning, NB_SEMAINES } from "@/lib/planning";

export const Route = createFileRoute("/planning")({
  head: () => ({
    meta: [
      { title: "Planning 14 semaines — Budget familial FCFA" },
      {
        name: "description",
        content:
          "Visualisez vos 14 prochaines semaines : revenus attendus, dépenses planifiées, soldes projetés et semaines à risque.",
      },
      { property: "og:title", content: "Planning 14 semaines" },
      {
        property: "og:description",
        content:
          "Projection semaine par semaine de vos revenus, dépenses planifiées et soldes d'enveloppes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PagePlanning,
});

function jourCourt(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function PagePlanning() {
  const { budgets, transactions, enveloppes, depensesParEnveloppe, solde } = useSuperApp();
  const [ouverte, setOuverte] = useState<number | null>(1);

  const planning = useMemo(() => {
    const parId: Record<string, number> = {};
    for (const e of enveloppes) {
      parId[e.id] = depensesParEnveloppe[e.nom] ?? depensesParEnveloppe[e.id] ?? 0;
    }
    return construirePlanning({
      budgets,
      transactions,
      enveloppes,
      depensesParEnveloppe: parId,
      soldeActuel: solde,
    });
  }, [budgets, transactions, enveloppes, depensesParEnveloppe, solde]);

  const maxi = Math.max(
    1,
    ...planning.semaines.map((s) => Math.max(s.depensesPrevues, s.revenusAttendus)),
  );

  return (
    <div className="space-y-4">
      <BoutonRetour to="/" label="Retour à l'accueil" />

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <CalendarRange aria-hidden className="h-5 w-5 text-primary" />
          Planning de {NB_SEMAINES} semaines
        </h1>
        <p className="text-sm text-muted-foreground">
          Projection de vos revenus attendus, dépenses planifiées et soldes semaine après
          semaine.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2">
        <Carte
          titre="Dépenses prévues"
          valeur={formatFCFA(planning.totalPrevu)}
          icone={<TrendingDown aria-hidden className="h-4 w-4 text-destructive" />}
        />
        <Carte
          titre="Revenus attendus"
          valeur={formatFCFA(planning.totalRevenus)}
          icone={<TrendingUp aria-hidden className="h-4 w-4 text-primary" />}
        />
        <Carte
          titre="Revenu hebdo moyen"
          valeur={formatFCFA(planning.revenuHebdoMoyen)}
          icone={<CalendarRange aria-hidden className="h-4 w-4 text-muted-foreground" />}
        />
        <Carte
          titre={`Solde projeté à S${NB_SEMAINES}`}
          valeur={formatFCFA(planning.soldeFinal)}
          alerte={planning.soldeFinal < 0}
          icone={<TrendingUp aria-hidden className="h-4 w-4 text-muted-foreground" />}
        />
      </section>

      {planning.alertes.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle aria-hidden className="h-4 w-4" />
            Enveloppes à risque
          </h2>
          <ul className="space-y-1 text-xs">
            {planning.alertes.map((a) => (
              <li key={a.enveloppe.id}>
                <span className="font-medium">
                  {a.enveloppe.emoji} {a.enveloppe.nom}
                </span>{" "}
                — semaine {a.semaine} ({jourCourt(a.debut)}) : {a.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Semaine par semaine</h2>
        <ul className="space-y-2">
          {planning.semaines.map((s) => {
            const ouvert = ouverte === s.index;
            return (
              <li
                key={s.index}
                className={`overflow-hidden rounded-2xl border ${
                  s.risque ? "border-destructive/50" : "border-input"
                } bg-card`}
              >
                <button
                  type="button"
                  onClick={() => setOuverte(ouvert ? null : s.index)}
                  aria-expanded={ouvert}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/30"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {s.libelle}
                      {s.courante && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                          en cours
                        </span>
                      )}
                      {s.risque && (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] text-destructive">
                          à risque
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {jourCourt(s.debut)} → {jourCourt(s.fin)} · {s.echeances.length} échéance
                      {s.echeances.length > 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold">
                      {formatFCFA(s.depensesPrevues)}
                    </span>
                    <span
                      className={`block text-[11px] ${
                        s.soldeProjete < 0 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      solde {formatFCFA(s.soldeProjete)}
                    </span>
                  </span>
                </button>

                <div className="px-3 pb-2">
                  <div className="flex h-2 gap-1">
                    <span
                      className="rounded-full bg-primary/60"
                      style={{ width: `${(s.revenusAttendus / maxi) * 50}%` }}
                    />
                    <span
                      className="rounded-full bg-destructive/60"
                      style={{ width: `${(s.depensesPrevues / maxi) * 50}%` }}
                    />
                  </div>
                </div>

                {ouvert && (
                  <div className="space-y-2 border-t border-input px-3 py-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <Ligne label="Revenus attendus" valeur={formatFCFA(s.revenusAttendus)} />
                      <Ligne label="Revenus réels" valeur={formatFCFA(s.revenusReels)} />
                      <Ligne label="Dépenses prévues" valeur={formatFCFA(s.depensesPrevues)} />
                      <Ligne label="Dépenses réelles" valeur={formatFCFA(s.depensesReelles)} />
                    </div>
                    {s.echeances.length === 0 ? (
                      <p className="text-muted-foreground">Aucune dépense planifiée.</p>
                    ) : (
                      <ul className="space-y-1">
                        {s.echeances.map((e, i) => {
                          const env = enveloppes.find((x) => x.id === e.budget.enveloppeId);
                          return (
                            <li
                              key={`${e.budget.id}-${e.date}-${i}`}
                              className="flex items-center justify-between gap-2 rounded-xl bg-accent/20 px-2 py-1"
                            >
                              <span className="min-w-0 truncate">
                                {jourCourt(e.date)} · {e.budget.libelle}
                                {env ? ` · ${env.emoji} ${env.nom}` : ""}
                              </span>
                              <span className="shrink-0 font-medium">
                                {formatFCFA(e.montant)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Carte({
  titre,
  valeur,
  icone,
  alerte,
}: {
  titre: string;
  valeur: string;
  icone: React.ReactNode;
  alerte?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        alerte ? "border-destructive/50 bg-destructive/5" : "border-input bg-card"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icone}
        {titre}
      </div>
      <p className={`mt-1 text-sm font-semibold ${alerte ? "text-destructive" : ""}`}>
        {valeur}
      </p>
    </div>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-xl bg-accent/20 px-2 py-1">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <span className="font-medium">{valeur}</span>
    </div>
  );
}
