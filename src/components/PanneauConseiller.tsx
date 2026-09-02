import { useState } from "react";
import { Brain, CalendarRange, LineChart, Sun, Volume2, Square, X } from "lucide-react";
import { FicheAnalyses } from "@/components/FicheAnalyses";
import { FicheOutils } from "@/components/FicheOutils";
import { vocalisationDisponible } from "@/lib/vocalisation";
import { useCerveau } from "@/lib/cerveau/hook";
import { enTexteVocal } from "@/lib/cerveau";
import { texteBilanMensuel, type BilanMensuel } from "@/lib/coach";
import {
  texteBilanSaisonnier,
  texteProjection,
  type BilanSaisonnier,
  type MoisProjete,
} from "@/lib/saison";

/** Pastille de gravité des constats du cerveau local. */
const PUCE_CONSTAT = { alerte: "🚨", attention: "⚠️", info: "💡", bravo: "✅" } as const;

function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

/**
 * Panneau « infos du contact » : tous les bilans du conseiller, sortis du fil
 * de discussion pour que la messagerie reste une vraie conversation.
 */
export function PanneauConseiller({
  ouvert,
  onFermer,
  mensuel,
  saison,
  projection,
  lecture,
  onLire,
}: {
  ouvert: boolean;
  onFermer: () => void;
  mensuel: BilanMensuel;
  saison: BilanSaisonnier;
  projection: MoisProjete[];
  lecture: string | null;
  onLire: (cle: string, texte: string) => void;
}) {
  const [onglet, setOnglet] = useState<"bilan" | "analyses" | "outils">("bilan");
  const cerveau = useCerveau();

  if (!ouvert) return null;

  const boutonLecture = (cle: string, texte: string, label: string) =>
    vocalisationDisponible() && (
      <button
        type="button"
        onClick={() => onLire(cle, texte)}
        aria-label={label}
        className="rounded-full p-1.5 text-primary"
      >
        {lecture === cle ? (
          <Square className="h-4 w-4" aria-hidden />
        ) : (
          <Volume2 className="h-4 w-4" aria-hidden />
        )}
      </button>
    );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-foreground/40 backdrop-blur-sm">
      <button type="button" aria-label="Fermer le panneau" onClick={onFermer} className="flex-1" />
      <div className="max-h-[82vh] overflow-y-auto rounded-t-3xl bg-background p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Tableau de bord du conseiller</h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-full p-1.5"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { id: "bilan", label: "Bilan" },
              { id: "analyses", label: "Analyses" },
              { id: "outils", label: "Outils & alertes" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOnglet(o.id)}
              aria-pressed={onglet === o.id}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                onglet === o.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {onglet === "analyses" && <FicheAnalyses />}
        {onglet === "outils" && <FicheOutils />}

        <div className={onglet === "bilan" ? "space-y-3" : "hidden"}>
          <section className="carte space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <CalendarRange className="h-4 w-4 text-primary" aria-hidden />
                Bilan mensuel
              </h3>
              {boutonLecture("mensuel", texteBilanMensuel(mensuel), "Écouter le bilan mensuel")}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Revenus</dt>
                <dd className="font-semibold text-success">{fcfa(mensuel.revenus)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Dépenses</dt>
                <dd className="font-semibold text-destructive">{fcfa(mensuel.depenses)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Solde du mois</dt>
                <dd className="font-semibold">{fcfa(mensuel.solde)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Solde global</dt>
                <dd className="font-semibold">{fcfa(mensuel.soldeGlobal)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Épargne</dt>
                <dd className="font-semibold">{mensuel.tauxEpargne} %</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Projection fin de mois</dt>
                <dd className="font-semibold">{fcfa(mensuel.projection)}</dd>
              </div>
            </dl>
          </section>

          <section className="carte space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Brain className="h-4 w-4 text-primary" aria-hidden />
                Ce que je constate
              </h3>
              {boutonLecture(
                "constats",
                cerveau.constats.slice(0, 5).map(enTexteVocal).join(" ") || cerveau.resume,
                "Écouter les constats",
              )}
            </div>
            <p className="text-xs text-muted-foreground">{cerveau.resume}</p>
            {cerveau.constats.length > 0 ? (
              <ul className="space-y-1.5 text-xs">
                {cerveau.constats.slice(0, 6).map((c) => (
                  <li key={c.id} className="rounded-lg border border-border/70 p-2">
                    <p className="font-semibold">
                      <span aria-hidden>{PUCE_CONSTAT[c.gravite]}</span> {c.titre}
                    </p>
                    <p className="text-muted-foreground">{c.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Rien d'anormal détecté pour l'instant.
              </p>
            )}
          </section>

          <section className="carte space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Sun className="h-4 w-4 text-primary" aria-hidden />
                Bilan saisonnier · {saison.mois}
              </h3>
              {boutonLecture("saison", texteBilanSaisonnier(saison), "Écouter le bilan saisonnier")}
            </div>
            <p className="text-xs text-muted-foreground">{saison.saison}</p>
            <p className="text-xs">
              Ce mois-ci&nbsp;: <strong>{fcfa(saison.depenses)}</strong> · même saison l'an
              dernier&nbsp;: <strong>{fcfa(saison.depensesAnneePrecedente)}</strong>
              {saison.historique && (
                <span className={saison.ecart > 0 ? "text-destructive" : "text-success"}>
                  {" "}
                  ({saison.ecart > 0 ? "+" : ""}
                  {saison.ecartPct} %)
                </span>
              )}
            </p>
            {saison.enveloppes.length > 0 && (
              <ul className="space-y-1 text-xs">
                {saison.enveloppes.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {l.emoji} {l.nom}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {fcfa(l.actuel)} vs {fcfa(l.anneePrecedente)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ul className="space-y-1 text-xs text-muted-foreground">
              {saison.conseils.map((c) => (
                <li key={c}>• {c}</li>
              ))}
            </ul>
          </section>

          <section className="carte space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <LineChart className="h-4 w-4 text-primary" aria-hidden />
                Projection des 6 prochains mois
              </h3>
              {boutonLecture("projection", texteProjection(projection), "Écouter la projection")}
            </div>
            <ul className="space-y-2">
              {projection.map((m) => (
                <li key={m.cle} className="rounded-lg bg-muted/40 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold capitalize">{m.libelle}</span>
                    <span className={m.solde < 0 ? "text-destructive" : "text-success"}>
                      {fcfa(m.solde)}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {fcfa(m.revenus)} entrées · {fcfa(m.depenses)} sorties · cumul{" "}
                    {fcfa(m.soldeCumule)}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">{m.conseil}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
