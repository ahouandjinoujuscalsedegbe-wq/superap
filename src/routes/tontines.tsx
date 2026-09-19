import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { HandCoins, PiggyBank } from "lucide-react";

import { COMPTE_TONTINES, useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { suivreTontines } from "@/lib/tontines";

export const Route = createFileRoute("/tontines")({
  head: () => ({
    meta: [
      { title: "Suivi des tontines — SUPER APP" },
      {
        name: "description",
        content:
          "Suivez en temps réel chaque tontine : cotisations versées, part restante dans le compte Tontines et prochaine échéance.",
      },
      { property: "og:title", content: "Suivi des tontines en temps réel" },
      {
        property: "og:description",
        content: "Chaque tontine garde ses fonds séparés dans le compte Tontines, sans mélange.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageTontines,
});

function PageTontines() {
  const { objectifs, transferts, chargement } = useSuperApp();
  const [tic, setTic] = useState(0);

  // Rafraîchissement régulier pour un suivi « en direct » des échéances.
  useEffect(() => {
    const t = window.setInterval(() => setTic((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const { suivis, nonClasse, total } = useMemo(() => {
    void tic;
    return suivreTontines(objectifs, transferts);
  }, [objectifs, transferts, tic]);

  if (chargement) return <p className="pt-6 text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="space-y-5 pt-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <HandCoins className="h-6 w-6 text-primary" aria-hidden />
          Suivi des tontines
        </h1>
        <p className="text-sm text-muted-foreground">
          Chaque tontine garde ses cotisations séparées dans le compte « {COMPTE_TONTINES} ».
        </p>
      </header>

      <section className="carte grid grid-cols-2 gap-3 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Total dans le compte
          </p>
          <p className="text-lg font-bold tabular-nums">{formatFCFA(total)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Non rattaché à une tontine
          </p>
          <p
            className={`text-lg font-bold tabular-nums ${nonClasse > 0 ? "text-warning" : "text-muted-foreground"}`}
          >
            {formatFCFA(nonClasse)}
          </p>
        </div>
      </section>

      {suivis.length === 0 && (
        <div className="carte flex flex-col items-center gap-2 p-8 text-center">
          <PiggyBank className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Aucune tontine enregistrée. Créez-en une depuis la page Objectifs.
          </p>
          <Link to="/objectifs" className="text-sm font-semibold text-primary">
            Aller aux objectifs
          </Link>
        </div>
      )}

      {suivis.map((s) => (
        <article key={s.objectif.id} className="carte space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{s.objectif.libelle}</h2>
              {s.objectif.tontineOrganisateur && (
                <p className="truncate text-xs text-muted-foreground">
                  Groupe : {s.objectif.tontineOrganisateur}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {s.tours} cotisation{s.tours > 1 ? "s" : ""}
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${s.progression}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Part dans le compte
              </p>
              <p className="font-bold tabular-nums text-success">{formatFCFA(s.solde)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Total cotisé
              </p>
              <p className="font-bold tabular-nums">{formatFCFA(s.cotise)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Ressorti</p>
              <p className="font-bold tabular-nums">{formatFCFA(s.retire)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Prochaine cotisation
              </p>
              <p className="font-bold tabular-nums">
                {s.prochaine
                  ? `${s.prochaine.date} · ${formatFCFA(s.prochaine.montant)}`
                  : "Aucun rappel"}
              </p>
            </div>
          </div>

          {s.dernier && (
            <p className="text-xs text-muted-foreground">Dernière cotisation le {s.dernier}.</p>
          )}

          {s.mouvements.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold">Mouvements de cette tontine</p>
              {s.mouvements.slice(0, 12).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{m.date}</span>
                    <span className="block truncate text-muted-foreground">
                      {m.sens === "entree" ? `depuis ${m.contrepartie}` : `vers ${m.contrepartie}`}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${m.sens === "entree" ? "text-success" : "text-destructive"}`}
                  >
                    {m.sens === "entree" ? "+" : "−"}
                    {formatFCFA(m.montant)}
                  </span>
                </div>
              ))}
              {s.mouvements.length > 12 && (
                <p className="text-[11px] text-muted-foreground">
                  Et {s.mouvements.length - 12} mouvement(s) plus ancien(s).
                </p>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
