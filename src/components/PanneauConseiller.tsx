import { CalendarRange, LineChart, Sun, Volume2, Square, X } from "lucide-react";
import { vocalisationDisponible } from "@/lib/vocalisation";
import type { BilanEnveloppe } from "@/lib/coach-enveloppe";
import type { BilanMensuel, MemoireCoach } from "@/lib/coach";
import { texteBilanMensuel } from "@/lib/coach";
import {
  texteBilanSaisonnier,
  texteProjection,
  type BilanSaisonnier,
  type MoisProjete,
} from "@/lib/saison";

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
  bilans,
  memoire,
  lecture,
  onLire,
  onDemander,
}: {
  ouvert: boolean;
  onFermer: () => void;
  mensuel: BilanMensuel;
  saison: BilanSaisonnier;
  projection: MoisProjete[];
  bilans: BilanEnveloppe[];
  memoire: MemoireCoach;
  lecture: string | null;
  onLire: (cle: string, texte: string) => void;
  onDemander: (question: string) => void;
}) {
  const [enveloppeOuverte, setEnveloppeOuverte] = useState<string | null>(null);
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
      <button
        type="button"
        aria-label="Fermer le panneau"
        onClick={onFermer}
        className="flex-1"
      />
      <div className="max-h-[82vh] overflow-y-auto rounded-t-3xl bg-background p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Tableau de bord du conseiller</h2>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="rounded-full p-1.5">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-3">
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
                <Sun className="h-4 w-4 text-primary" aria-hidden />
                Bilan saisonnier · {saison.mois}
              </h3>
              {boutonLecture("saison", texteBilanSaisonnier(saison), "Écouter le bilan saisonnier")}
            </div>
            <p className="text-xs text-muted-foreground">{saison.saison}</p>
            <p className="text-xs">
              Ce mois-ci&nbsp;: <strong>{fcfa(saison.depenses)}</strong> · même saison l'an dernier&nbsp;:{" "}
              <strong>{fcfa(saison.depensesAnneePrecedente)}</strong>
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
                    {fcfa(m.revenus)} entrées · {fcfa(m.depenses)} sorties · cumul {fcfa(m.soldeCumule)}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">{m.conseil}</p>
                </li>
              ))}
            </ul>
          </section>

          {bilans.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Wallet className="h-4 w-4 text-primary" aria-hidden />
                Conseiller par enveloppe
              </h3>
              {bilans.map((b) => {
                const ouvertEnv = enveloppeOuverte === b.enveloppe.id;
                const interet = poidsEnveloppeDe(memoire, b.enveloppe.id);
                return (
                  <article key={b.enveloppe.id} className="carte overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setEnveloppeOuverte(ouvertEnv ? null : b.enveloppe.id)}
                      aria-expanded={ouvertEnv}
                      className="flex w-full items-center gap-3 p-3 text-left"
                    >
                      <span aria-hidden className="text-lg">
                        {b.enveloppe.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{b.enveloppe.nom}</span>
                        <span className="block truncate text-xs text-muted-foreground">{b.resume}</span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${
                          b.score >= 70
                            ? "bg-success/15 text-success"
                            : b.score >= 40
                              ? "bg-accent/30 text-foreground"
                              : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {b.score}/100
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          ouvertEnv ? "rotate-180" : ""
                        }`}
                        aria-hidden
                      />
                    </button>
                    {ouvertEnv && (
                      <div className="space-y-2 border-t border-border/60 p-3 text-xs">
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Dépensé sur 30 jours : {fcfa(b.depense30)}</li>
                          <li>
                            • Mois précédent : {fcfa(b.depense30Avant)}
                            {b.tendance !== 0 &&
                              ` (${b.tendance > 0 ? "+" : ""}${Math.round(b.tendance)} %)`}
                          </li>
                          <li>• Rythme observé : {fcfa(b.rythmeJour)} par jour</li>
                          <li>• Opérations analysées : {b.operations}</li>
                        </ul>
                        {b.conseils.map((c) => (
                          <div key={c.id} className="rounded-xl bg-muted/50 p-2">
                            <p className="font-medium text-foreground">{c.texte}</p>
                            <p className="mt-1 text-muted-foreground">À faire : {c.action}</p>
                          </div>
                        ))}
                        <p className="text-[0.7rem] text-muted-foreground">
                          Intérêt appris pour cette enveloppe : {Math.round(interet * 100)} %
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onDemander(`Où en est mon enveloppe ${b.enveloppe.nom} ?`);
                            onFermer();
                          }}
                          className="rounded-full border border-input px-3 py-1.5 text-[0.7rem]"
                        >
                          En parler dans la discussion
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
