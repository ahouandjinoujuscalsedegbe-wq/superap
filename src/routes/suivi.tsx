import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { useSuperApp } from "@/lib/store";
import { lireProjets, type ProjetFutur } from "@/lib/previsions";
import { suivreDepensesReelles, type MoisSuivi } from "@/lib/suivi-reel";

export const Route = createFileRoute("/suivi")({
  head: () => ({
    meta: [
      { title: "Suivi des dépenses réelles mois par mois — SUPER APP" },
      {
        name: "description",
        content:
          "Comparez chaque mois vos dépenses réelles à la prévision mois par mois : écart global, écart par enveloppe et fiabilité de vos prévisions, hors ligne et en FCFA.",
      },
      { property: "og:title", content: "Suivi des dépenses réelles — SUPER APP" },
      {
        property: "og:description",
        content:
          "Réel contre prévu, mois par mois et enveloppe par enveloppe, calculé sur votre téléphone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageSuivi,
});

const LIMITES = [6, 12, 24];

const COULEUR: Record<MoisSuivi["statut"], string> = {
  conforme: "text-success",
  depassement: "text-destructive",
  sous: "text-primary",
};

const ETIQUETTE: Record<MoisSuivi["statut"], string> = {
  conforme: "Conforme à la prévision",
  depassement: "Au-dessus de la prévision",
  sous: "Sous la prévision",
};

function PageSuivi() {
  const { transactions, enveloppes, objectifs } = useSuperApp();
  const [projets, setProjets] = useState<ProjetFutur[]>([]);
  const [limite, setLimite] = useState(12);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [vue, setVue] = useState<"categories" | "enveloppes">("categories");

  useEffect(() => {
    let vivant = true;
    lireProjets().then((liste) => {
      if (vivant) setProjets(liste);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const suivi = useMemo(
    () => suivreDepensesReelles({ transactions, enveloppes, objectifs, projets, limite }),
    [transactions, enveloppes, objectifs, projets, limite],
  );

  return (
    <div className="space-y-4 pt-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Scale className="h-6 w-6 text-primary" aria-hidden />
          Suivi réel / prévu
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vos dépenses réelles, mois par mois, face à ce que la{" "}
          <Link
            to="/previsions"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Prévision mois par mois
          </Link>{" "}
          annonçait.
        </p>
      </header>

      <section className="carte space-y-2 p-4">
        <p className="text-sm">{suivi.resume}</p>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <p className="text-xs text-muted-foreground">Écart moyen mensuel</p>
            <p
              className={`text-lg font-bold ${suivi.ecartMoyen > 0 ? "text-destructive" : "text-success"}`}
            >
              {suivi.ecartMoyen > 0 ? "+" : ""}
              {formatFCFA(suivi.ecartMoyen)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Mois tenus</p>
            <p className="text-lg font-bold">{suivi.fiabilite} %</p>
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        {LIMITES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setLimite(n)}
            aria-pressed={limite === n}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              limite === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card hover:bg-accent/40"
            }`}
          >
            {n} mois
          </button>
        ))}
      </div>

      <section className="space-y-3">
        {suivi.mois.map((m) => {
          const estOuvert = ouvert === m.mois;
          const part =
            m.depensesPrevues > 0
              ? Math.min(160, Math.round((m.depensesReelles / m.depensesPrevues) * 100))
              : 0;
          return (
            <article key={m.mois} className="carte overflow-hidden">
              <button
                type="button"
                onClick={() => setOuvert(estOuvert ? null : m.mois)}
                aria-expanded={estOuvert}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-semibold capitalize">{m.libelle}</h2>
                    {m.enCours && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-primary">
                        en cours
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-muted-foreground">
                      Prévu :{" "}
                      <span className="font-semibold text-foreground">
                        {formatFCFA(m.depensesPrevues)}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Réel :{" "}
                      <span className="font-semibold text-foreground">
                        {formatFCFA(m.depensesReelles)}
                      </span>
                    </p>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        m.statut === "depassement" ? "bg-destructive" : "bg-primary"
                      }`}
                      style={{ width: `${Math.max(2, Math.min(100, part))}%` }}
                    />
                  </div>

                  <p className={`flex items-center gap-1 text-xs font-medium ${COULEUR[m.statut]}`}>
                    {m.ecartDepenses > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {ETIQUETTE[m.statut]} · {m.ecartDepenses > 0 ? "+" : ""}
                    {formatFCFA(m.ecartDepenses)} ({m.ecartPourcent > 0 ? "+" : ""}
                    {m.ecartPourcent} %)
                  </p>
                </div>
                <ChevronDown
                  className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    estOuvert ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>

              {estOuvert && (
                <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <p className="text-muted-foreground">
                      Revenus prévus :{" "}
                      <span className="font-semibold text-foreground">
                        {formatFCFA(m.revenusPrevus)}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Revenus réels :{" "}
                      <span className="font-semibold text-foreground">
                        {formatFCFA(m.revenusReels)}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Net prévu :{" "}
                      <span className="font-semibold text-foreground">
                        {formatFCFA(m.netPrevu)}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Net réel :{" "}
                      <span className="font-semibold text-foreground">{formatFCFA(m.netReel)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Opérations :{" "}
                      <span className="font-semibold text-foreground">{m.operations}</span>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {(["categories", "enveloppes"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVue(v)}
                        aria-pressed={vue === v}
                        className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                          vue === v
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-card hover:bg-accent/40"
                        }`}
                      >
                        {v === "categories" ? "Par catégorie" : "Par enveloppe"}
                      </button>
                    ))}
                  </div>

                  {vue === "categories" ? (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground">
                        Réel / prévu par catégorie
                      </h3>
                      {m.ecartsCategories.length === 0 && (
                        <p className="text-xs text-muted-foreground">Aucune dépense ce mois-ci.</p>
                      )}
                      {m.ecartsCategories.map((c) => (
                        <div key={c.categorie} className="rounded-lg bg-muted/40 p-2.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate font-medium">
                              {c.emoji} {c.categorie}
                              <span className="ml-1 text-muted-foreground">({c.part} %)</span>
                            </span>
                            <span className="shrink-0 text-muted-foreground">
                              {formatFCFA(c.reel)} / {formatFCFA(c.prevu)}{" "}
                              <span
                                className={
                                  c.ecart > 0
                                    ? "font-semibold text-destructive"
                                    : "font-semibold text-success"
                                }
                              >
                                ({c.ecart > 0 ? "+" : ""}
                                {formatFCFA(c.ecart)})
                              </span>
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${
                                c.ecart > 0 ? "bg-destructive" : "bg-primary"
                              }`}
                              style={{
                                width: `${Math.max(
                                  2,
                                  Math.min(
                                    100,
                                    c.prevu > 0 ? Math.round((c.reel / c.prevu) * 100) : 100,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                          <ul className="mt-1.5 space-y-0.5">
                            {c.enveloppes.slice(0, 5).map((e) => (
                              <li
                                key={e.enveloppeId}
                                className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
                              >
                                <span className="min-w-0 truncate">
                                  {e.emoji} {e.nom}
                                </span>
                                <span className="shrink-0">
                                  {formatFCFA(e.reel)} / {formatFCFA(e.prevu)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-semibold text-muted-foreground">
                        Écart par enveloppe
                      </h3>
                      {m.ecartsEnveloppes.length === 0 && (
                        <p className="text-xs text-muted-foreground">Aucune dépense ce mois-ci.</p>
                      )}
                      {m.ecartsEnveloppes.slice(0, 12).map((e) => (
                        <div
                          key={e.enveloppeId}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="min-w-0 truncate">
                            {e.emoji} {e.nom}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatFCFA(e.reel)} / {formatFCFA(e.prevu)}{" "}
                            <span
                              className={
                                e.ecart > 0
                                  ? "font-semibold text-destructive"
                                  : "font-semibold text-success"
                              }
                            >
                              ({e.ecart > 0 ? "+" : ""}
                              {formatFCFA(e.ecart)})
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
