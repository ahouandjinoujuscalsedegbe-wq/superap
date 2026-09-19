import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { HandCoins, Users } from "lucide-react";

import { COMPTE_CREANCES, resteDu, useSuperApp, type Dette } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/debiteurs")({
  head: () => ({
    meta: [
      { title: "Mes débiteurs — SUPER APP" },
      {
        name: "description",
        content:
          "Suivez chaque personne qui vous doit de l'argent : solde restant dû, prochaine échéance et historique des remboursements.",
      },
      { property: "og:title", content: "Mes débiteurs — suivi des remboursements" },
      {
        property: "og:description",
        content:
          "Solde dû par personne, prochaine échéance attendue et remboursements reçus, au franc près.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageDebiteurs,
});

type SuiviDebiteur = {
  personne: string;
  du: number;
  prete: number;
  rembourse: number;
  fiches: Dette[];
  prochaine: { date: string; montant: number } | null;
  progression: number;
};

/** Regroupe les créances par personne et calcule son suivi. */
function suivreDebiteurs(dettes: Dette[]): { suivis: SuiviDebiteur[]; total: number } {
  const creances = dettes.filter((d) => d.sens === "creance");
  const parPersonne = new Map<string, Dette[]>();
  creances.forEach((d) => {
    const cle = d.personne.trim() || "Sans nom";
    parPersonne.set(cle, [...(parPersonne.get(cle) ?? []), d]);
  });

  const suivis: SuiviDebiteur[] = Array.from(parPersonne.entries()).map(([personne, fiches]) => {
    const prete = fiches.reduce((s, d) => s + Math.round(d.montantInitial), 0);
    const rembourse = fiches.reduce(
      (s, d) => s + d.remboursements.reduce((t, r) => t + Math.round(r.montant), 0),
      0,
    );
    const du = fiches.reduce((s, d) => s + resteDu(d), 0);

    // Prochaine échéance attendue : échéancier actif le plus proche, sinon date limite.
    const dates: { date: string; montant: number }[] = [];
    fiches.forEach((d) => {
      if (d.echeancier?.actif && d.echeancier.prochaine) {
        dates.push({ date: d.echeancier.prochaine, montant: Math.round(d.echeancier.montant) });
      } else if (d.dateLimite && resteDu(d) > 0) {
        dates.push({ date: d.dateLimite, montant: resteDu(d) });
      }
    });
    dates.sort((a, b) => a.date.localeCompare(b.date));

    return {
      personne,
      du,
      prete,
      rembourse,
      fiches,
      prochaine: dates[0] ?? null,
      progression: prete > 0 ? Math.min(100, Math.round((rembourse / prete) * 100)) : 0,
    };
  });

  suivis.sort((a, b) => b.du - a.du || a.personne.localeCompare(b.personne));
  return { suivis, total: suivis.reduce((s, x) => s + x.du, 0) };
}

function PageDebiteurs() {
  const { dettes, chargement } = useSuperApp();
  const { suivis, total } = useMemo(() => suivreDebiteurs(dettes), [dettes]);

  if (chargement) return <p className="pt-6 text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="space-y-5 pt-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6 text-primary" aria-hidden />
          Mes débiteurs
        </h1>
        <p className="text-sm text-muted-foreground">
          Tout ce qu'on vous doit, personne par personne. Ces sommes restent dans le compte «{" "}
          {COMPTE_CREANCES} » et n'entrent pas dans votre solde disponible.
        </p>
      </header>

      <section className="carte grid grid-cols-2 gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total restant dû</p>
          <p className="text-xl font-bold tabular-nums">{formatFCFA(total)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Débiteurs suivis</p>
          <p className="text-xl font-bold tabular-nums">{suivis.length}</p>
        </div>
      </section>

      {suivis.length === 0 && (
        <section className="carte space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Personne ne vous doit d'argent pour l'instant. Enregistrez une créance pour la suivre
            ici.
          </p>
          <Link
            to="/dettes"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <HandCoins className="h-4 w-4" aria-hidden /> Enregistrer une créance
          </Link>
        </section>
      )}

      {suivis.map((s) => (
        <section key={s.personne} className="carte space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">{s.personne}</h2>
              <p className="text-xs text-muted-foreground">
                {s.fiches.length} créance{s.fiches.length > 1 ? "s" : ""} suivie
                {s.fiches.length > 1 ? "s" : ""}
              </p>
            </div>
            <p className="text-lg font-bold tabular-nums text-destructive">{formatFCFA(s.du)}</p>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${s.progression}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Prêté au total</p>
              <p className="font-semibold tabular-nums">{formatFCFA(s.prete)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Déjà remboursé</p>
              <p className="font-semibold tabular-nums text-success">{formatFCFA(s.rembourse)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Prochaine échéance
              </p>
              <p className="font-semibold tabular-nums">
                {s.prochaine
                  ? `${s.prochaine.date} — ${formatFCFA(s.prochaine.montant)}`
                  : "Aucune date prévue"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Remboursements reçus
            </p>
            {s.fiches.flatMap((d) => d.remboursements.map((r) => ({ ...r, fiche: d }))).length ===
            0 ? (
              <p className="text-sm text-muted-foreground">Aucun remboursement pour le moment.</p>
            ) : (
              s.fiches
                .flatMap((d) => d.remboursements.map((r) => ({ ...r, fiche: d })))
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 12)
                .map((r) => (
                  <div
                    key={r.id}
                    className="surface flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {r.date}
                      {r.note ? ` — ${r.note}` : ""}
                    </span>
                    <span className="font-semibold tabular-nums text-success">
                      {formatFCFA(Math.round(r.montant))}
                    </span>
                  </div>
                ))
            )}
          </div>

          <Link
            to="/dettes"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
          >
            Gérer les créances de {s.personne}
          </Link>
        </section>
      ))}
    </div>
  );
}
