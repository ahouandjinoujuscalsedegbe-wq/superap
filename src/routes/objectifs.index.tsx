import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PiggyBank, Target } from "lucide-react";
import { HistoriqueRappels } from "@/components/HistoriqueRappels";

import { useSuperApp, type TypeObjectif, type UniteRappel } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { suivreObjectifs, type SuiviObjectif } from "@/lib/objectifs";
import { rythmeObjectif } from "@/lib/rappels-objectifs";

export const Route = createFileRoute("/objectifs/")({
  head: () => ({
    meta: [
      { title: "Objectifs d'épargne — SUPER APP" },
      {
        name: "description",
        content:
          "Retrouvez vos épargnes, achats programmés et tontines classés par catégorie, avec leur progression.",
      },
      { property: "og:title", content: "Objectifs d'épargne intelligents" },
      {
        property: "og:description",
        content: "Épargnes, achats programmés et tontines, classés et suivis automatiquement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageObjectifs,
});

const COULEURS: Record<SuiviObjectif["etat"], string> = {
  atteint: "text-success",
  en_avance: "text-success",
  sur_la_bonne_voie: "text-primary",
  en_retard: "text-warning",
  en_danger: "text-destructive",
};

const ETIQUETTES: Record<SuiviObjectif["etat"], string> = {
  atteint: "Atteint",
  en_avance: "En avance",
  sur_la_bonne_voie: "Sur la bonne voie",
  en_retard: "En retard",
  en_danger: "En danger",
};

/** Les trois natures d'objectif, dans l'ordre d'affichage. */
const TYPES: Record<TypeObjectif, string> = {
  epargne: "Épargne",
  achat: "Achat programmé",
  tontine: "Tontine",
};

const UNITES: Record<UniteRappel, { un: string; plusieurs: string }> = {
  jour: { un: "jour", plusieurs: "jours" },
  semaine: { un: "semaine", plusieurs: "semaines" },
  mois: { un: "mois", plusieurs: "mois" },
  annee: { un: "an", plusieurs: "ans" },
};

/** Phrase lisible du rythme choisi : « tous les 15 jours ». */
function libelleRythme(intervalle: number, unite: UniteRappel): string {
  const n = Math.max(1, intervalle);
  if (n === 1) return unite === "annee" ? "chaque année" : `chaque ${UNITES[unite].un}`;
  return `tous les ${n} ${UNITES[unite].plusieurs}`;
}

/** Carte d'un objectif : progression, effort et historique des rappels. */
function CarteObjectif({ s }: { s: SuiviObjectif }) {
  const r = rythmeObjectif(s.objectif);
  return (
    <article className="carte space-y-3 p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold">{s.objectif.libelle}</h3>
          {s.objectif.atteintLe && (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
              Atteint le {s.objectif.atteintLe}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatFCFA(s.reuni)} sur {formatFCFA(s.objectif.cible)} ·{" "}
          {s.objectif.type === "tontine" ? "réception prévue" : "échéance"} {s.objectif.dateCible}
        </p>
        {s.objectif.type === "tontine" && s.objectif.tontineMontantTour && (
          <p className="text-xs text-muted-foreground">
            {formatFCFA(s.objectif.tontineMontantTour)} · rang {s.objectif.tontineRang ?? 1}/
            {s.objectif.tontineParticipants ?? 1}
            {s.objectif.tontineOrganisateur ? ` · ${s.objectif.tontineOrganisateur}` : ""}
          </p>
        )}
        {r && (
          <p className="text-xs text-primary">🔔 Rappel {libelleRythme(r.intervalle, r.unite)}</p>
        )}
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(s.progression)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progression de ${s.objectif.libelle}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(2, s.progression)}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-muted-foreground">Restant</p>
          <p className="mt-0.5 font-semibold">{formatFCFA(s.restant)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-muted-foreground">Par mois</p>
          <p className="mt-0.5 font-semibold">{formatFCFA(s.effortMensuel)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-muted-foreground">Jours</p>
          <p className="mt-0.5 font-semibold">{s.joursRestants}</p>
        </div>
      </div>

      <p className={`text-sm font-medium ${COULEURS[s.etat]}`}>
        {ETIQUETTES[s.etat]} — {s.message}
      </p>
      <HistoriqueRappels objectifId={s.objectif.id} />
    </article>
  );
}

function PageObjectifs() {
  const { objectifs, transactions, transferts } = useSuperApp();

  const suivis = useMemo(
    () => suivreObjectifs(objectifs, transactions, new Date(), transferts),
    [objectifs, transactions, transferts],
  );

  const groupes = useMemo(
    () =>
      (Object.keys(TYPES) as TypeObjectif[]).map((t) => ({
        type: t,
        titre: TYPES[t],
        elements: suivis.filter((s) => (s.objectif.type ?? "epargne") === t),
      })),
    [suivis],
  );

  return (
    <div className="space-y-5 pt-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Target className="h-6 w-6 text-primary" aria-hidden />
          Objectifs
        </h1>
      </header>

      {suivis.length === 0 && (
        <div className="carte flex flex-col items-center gap-2 p-8 text-center">
          <PiggyBank className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Aucun objectif pour le moment. Utilisez le bouton « Action » en haut pour en créer un.
          </p>
        </div>
      )}

      {groupes.map(
        (g) =>
          g.elements.length > 0 && (
            <section key={g.type} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {g.titre} ({g.elements.length})
              </h2>
              {g.elements.map((s) => (
                <CarteObjectif key={s.objectif.id} s={s} />
              ))}
            </section>
          ),
      )}
    </div>
  );
}
