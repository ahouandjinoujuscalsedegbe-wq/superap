import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PiggyBank, Target } from "lucide-react";

import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { suivreObjectifs } from "@/lib/suivi-objectifs";

export const Route = createFileRoute("/objectifs/suivi")({
  head: () => ({
    meta: [
      { title: "Suivi des objectifs — SUPER APP" },
      {
        name: "description",
        content:
          "Suivez en temps réel chaque objectif d'épargne ou d'achat programmé : versements, montant réuni, reste à réunir et prochaine échéance.",
      },
      { property: "og:title", content: "Suivi des objectifs en temps réel" },
      {
        property: "og:description",
        content:
          "Chaque objectif d'épargne ou d'achat garde ses versements séparés, sans mélange des fonds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageSuiviObjectifs,
});

const ETIQUETTES: Record<string, string> = {
  epargne: "Épargne",
  achat: "Achat programmé",
};

function PageSuiviObjectifs() {
  const { objectifs, transferts, chargement } = useSuperApp();
  const [tic, setTic] = useState(0);

  // Rafraîchissement régulier pour un suivi « en direct » des échéances.
  useEffect(() => {
    const t = window.setInterval(() => setTic((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const suivis = useMemo(() => {
    void tic;
    return suivreObjectifs(objectifs, transferts);
  }, [objectifs, transferts, tic]);

  const reuniTotal = suivis.reduce((s, o) => s + o.reuni, 0);
  const resteTotal = suivis.reduce((s, o) => s + o.restant, 0);

  if (chargement) return <p className="pt-6 text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="space-y-5 pt-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Target className="h-6 w-6 text-primary" aria-hidden />
          Suivi des objectifs
        </h1>
        <p className="text-sm text-muted-foreground">
          Épargne et achats programmés : chaque objectif garde ses versements séparés.
        </p>
      </header>

      <section className="carte grid grid-cols-2 gap-3 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Déjà réuni au total
          </p>
          <p className="text-lg font-bold tabular-nums text-success">{formatFCFA(reuniTotal)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Reste à réunir
          </p>
          <p className="text-lg font-bold tabular-nums">{formatFCFA(resteTotal)}</p>
        </div>
      </section>

      {suivis.length === 0 && (
        <div className="carte flex flex-col items-center gap-2 p-8 text-center">
          <PiggyBank className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Aucun objectif d'épargne ou d'achat enregistré.
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
              <p className="truncate text-xs text-muted-foreground">
                {ETIQUETTES[s.objectif.type ?? "epargne"] ?? "Épargne"}
                {s.compte ? ` · ${s.compte}` : " · aucun compte d'épargne choisi"}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {s.progression} %
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${s.progression}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Déjà réuni
              </p>
              <p className="font-bold tabular-nums text-success">{formatFCFA(s.reuni)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Reste à réunir
              </p>
              <p className="font-bold tabular-nums">{formatFCFA(s.restant)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Versé sur le compte
              </p>
              <p className="font-bold tabular-nums">{formatFCFA(s.verse)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Ressorti</p>
              <p className="font-bold tabular-nums">{formatFCFA(s.retire)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Objectif</p>
              <p className="font-bold tabular-nums">{formatFCFA(Math.round(s.objectif.cible))}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Prochain versement
              </p>
              <p className="font-bold tabular-nums">
                {s.prochain ? `${s.prochain.date} · ${formatFCFA(s.prochain.montant)}` : "Aucun rappel"}
              </p>
            </div>
          </div>

          {s.dernier && (
            <p className="text-xs text-muted-foreground">Dernier versement le {s.dernier}.</p>
          )}

          {s.mouvements.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold">Mouvements de cet objectif</p>
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
