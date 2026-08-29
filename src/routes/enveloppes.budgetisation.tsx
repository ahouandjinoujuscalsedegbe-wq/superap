import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Plus } from "lucide-react";
import { PERIODES, useSuperApp, type Periode } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { nombreEcheancesDues, equivalentMensuel, bornesPeriode, libellePlage } from "@/lib/periodes";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { Calendrier, jourISO } from "@/components/Calendrier";

export const Route = createFileRoute("/enveloppes/budgetisation")({
  head: () => ({
    meta: [
      { title: "Budgétisation — Prévoir vos dépenses par période en FCFA" },
      {
        name: "description",
        content:
          "Planifiez une dépense existante sur une période précise choisie au calendrier : jour, semaine, mois, trimestre, semestre ou année, en francs CFA.",
      },
      { property: "og:title", content: "Budgétisation — SUPER APP" },
      {
        property: "og:description",
        content:
          "Prévision des dépenses par période, prélèvement sur une enveloppe et conversion en dépenses réelles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Budgetisation,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

const libellePeriode = (p: Periode) => PERIODES.find((x) => x.id === p)?.label ?? p;

function Budgetisation() {
  const {
    enveloppes,
    budgets,
    comptes,
    transactions,
    ajouterBudget,
    convertirBudget,
    genererEcheancesDues,
    supprimerBudget,
  } = useSuperApp();

  type Demande =
    | {
        type: "creation";
        libelle: string;
        enveloppeId: string;
        montant: number;
        compte: string;
        prochaine: string;
        debut: string;
        fin: string;
        ponctuel: boolean;
      }
    | { type: "conversion-tout"; nb: number; montant: number }
    | { type: "conversion-un"; id: string; libelle: string; montant: number }
    | { type: "suppression"; id: string; libelle: string }
    | null;
  const [demande, setDemande] = useState<Demande>(null);

  const [popupOuvert, setPopupOuvert] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);

  const [periode, setPeriode] = useState<Periode>("semaine");
  const [jour, setJour] = useState(() => jourISO(new Date()));
  const [situation, setSituation] = useState("");
  const [autreSituation, setAutreSituation] = useState("");
  const [bEnveloppe, setBEnveloppe] = useState(enveloppes[0]?.id ?? "");
  const [bMontant, setBMontant] = useState("");
  const [bCompte, setBCompte] = useState(comptes[0] ?? "");
  const [recurrent, setRecurrent] = useState(false);

  const plage = useMemo(() => bornesPeriode(jour, periode), [jour, periode]);

  /** Dépenses déjà existantes dans l'application, proposées comme « situations ». */
  const situations = useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) if (t.type === "depense" && t.libelle.trim()) set.add(t.libelle.trim());
    for (const b of budgets) if (b.libelle.trim()) set.add(b.libelle.trim());
    return Array.from(set).sort((a, z) => a.localeCompare(z, "fr"));
  }, [transactions, budgets]);

  const libelleChoisi = situation === "__autre" ? autreSituation.trim() : situation.trim();

  const totalMensuel = budgets.reduce((s, b) => s + equivalentMensuel(b), 0);
  const dues = budgets.map((b) => ({ b, n: b.actif ? nombreEcheancesDues(b) : 0 }));
  const nbDues = dues.reduce((s, d) => s + d.n, 0);
  const montantDu = dues.reduce((s, d) => s + d.n * d.b.montant, 0);

  /** Dépenses planifiées et à venir, regroupées par enveloppe de prélèvement. */
  const groupes = useMemo(() => {
    const map = new Map<string, typeof budgets>();
    for (const b of budgets) {
      const cle = b.enveloppeId || "__sans";
      const liste = map.get(cle) ?? [];
      liste.push(b);
      map.set(cle, liste);
    }
    return Array.from(map.entries()).map(([id, liste]) => {
      const env = enveloppes.find((e) => e.id === id);
      return {
        id,
        nom: env ? `${env.emoji} ${env.nom}` : "Enveloppe supprimée",
        liste: liste.slice().sort((a, z) => (a.debut ?? a.prochaine).localeCompare(z.debut ?? z.prochaine)),
        total: liste.reduce((s, b) => s + b.montant, 0),
      };
    });
  }, [budgets, enveloppes]);

  const totalPlanifie = budgets.reduce((s, b) => s + b.montant, 0);

  const enveloppeChoisie = enveloppes.find((e) => e.id === bEnveloppe);

  function creerBudget(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = Number(bMontant);
    if (!libelleChoisi) {
      toast.error("Choisissez la dépense (situation) à planifier.");
      return;
    }
    if (!bEnveloppe || !enveloppes.some((e) => e.id === bEnveloppe)) {
      toast.error("Enveloppe introuvable : choisissez une enveloppe existante.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur <= 0) {
      toast.error("Montant invalide : saisissez un montant positif en FCFA.");
      return;
    }
    if (!bCompte) {
      toast.error("Choisissez le compte à débiter.");
      return;
    }
    setDemande({
      type: "creation",
      libelle: libelleChoisi,
      enveloppeId: bEnveloppe,
      montant: valeur,
      compte: bCompte,
      prochaine: new Date(`${plage.debut}T08:00:00`).toISOString(),
      debut: plage.debut,
      fin: plage.fin,
      ponctuel: !recurrent,
    });
  }

  function confirmer() {
    if (!demande) return;
    if (demande.type === "creation") {
      ajouterBudget({
        libelle: demande.libelle,
        enveloppeId: demande.enveloppeId,
        montant: demande.montant,
        periode,
        compte: demande.compte,
        prochaine: demande.prochaine,
        debut: demande.debut,
        fin: demande.fin,
        ponctuel: demande.ponctuel,
        actif: true,
      });
      setSituation("");
      setAutreSituation("");
      setBMontant("");
      setPopupOuvert(false);
      toast.success("Dépense prévue pour la période choisie.");
    } else if (demande.type === "conversion-tout") {
      genererEcheancesDues();
      toast.success("Dépenses réelles générées.");
    } else if (demande.type === "conversion-un") {
      convertirBudget(demande.id);
      toast.success("Dépense réelle créée.");
    } else {
      supprimerBudget(demande.id);
      toast.success("Dépense planifiée supprimée.");
    }
    setDemande(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <BoutonRetour to="/enveloppes/" label="Retour aux enveloppes" />
        <button
          type="button"
          onClick={() => setPopupOuvert(true)}
          className="inline-flex items-center gap-1 rounded-xl bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" />
          Planifier une dépense
        </button>
      </div>

      <section className="carte space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold">Budgétisation</h2>
          <p className="text-sm text-muted-foreground">
            Prévoyez une dépense existante sur une période précise : « cette semaine, tel montant
            pour telle situation, prélevé dans telle enveloppe ».
          </p>
        </div>

        <div className="rounded-xl bg-secondary/60 p-3 text-sm">
          <p className="font-semibold">Total planifié : {formatFCFA(totalPlanifie)}</p>
          <p className="text-xs text-muted-foreground">
            Équivalent mensuel de tout le plan : {formatFCFA(totalMensuel)}
          </p>
        </div>

        {nbDues > 0 && (
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
            <p className="text-sm font-semibold">
              {nbDues} échéance{nbDues > 1 ? "s" : ""} à générer · {formatFCFA(montantDu)}
            </p>
            <button
              type="button"
              onClick={() => setDemande({ type: "conversion-tout", nb: nbDues, montant: montantDu })}
              className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Convertir en dépenses réelles
            </button>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Dépenses planifiées à venir, par enveloppe</h3>
          {groupes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune dépense planifiée. Utilisez « Planifier une dépense ».
            </p>
          ) : (
            groupes.map((g) => (
              <div key={g.id} className="space-y-2">
                <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span className="truncate">{g.nom}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {g.liste.length} · {formatFCFA(g.total)}
                  </span>
                </p>
                <ul className="space-y-2">
                  {g.liste.map((b) => {
                    const ouvert = ouverte === b.id;
                    return (
                      <li key={b.id} className="overflow-hidden rounded-xl border border-border/70">
                        <button
                          type="button"
                          onClick={() => setOuverte(ouvert ? null : b.id)}
                          aria-expanded={ouvert}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent/30"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{b.libelle}</span>
                            <span className="block text-xs text-muted-foreground">
                              {b.debut && b.fin
                                ? libellePlage({ debut: b.debut, fin: b.fin })
                                : formatDateFr(b.prochaine)}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-sm font-semibold">{formatFCFA(b.montant)}</span>
                            <ChevronDown
                              aria-hidden
                              className={`h-4 w-4 transition-transform ${ouvert ? "rotate-180" : ""}`}
                            />
                          </span>
                        </button>

                        {ouvert && (
                          <div className="space-y-2 border-t border-border/70 bg-background/40 p-3 text-xs">
                            <p>
                              <span className="text-muted-foreground">Enveloppe : </span>
                              {g.nom}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Type de période : </span>
                              {libellePeriode(b.periode)}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Compte débité : </span>
                              {b.compte}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Prochaine échéance : </span>
                              {formatDateFr(b.prochaine)}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Répétition : </span>
                              {b.ponctuel === false
                                ? `À chaque ${libellePeriode(b.periode).toLowerCase()}`
                                : "Une seule fois"}
                            </p>
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setDemande({
                                    type: "conversion-un",
                                    id: b.id,
                                    libelle: b.libelle,
                                    montant: b.montant,
                                  })
                                }
                                className="rounded-lg border border-input px-2.5 py-1 font-medium"
                              >
                                Convertir maintenant
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDemande({ type: "suppression", id: b.id, libelle: b.libelle })
                                }
                                className="rounded-lg border border-input px-2.5 py-1 font-medium text-destructive"
                              >
                                Supprimer
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>

      {popupOuvert && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Planifier une dépense"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center"
          onClick={() => setPopupOuvert(false)}
        >
          <div
            className="carte max-h-[85vh] w-full max-w-sm space-y-4 overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Planifier une dépense</h3>

            <div className="space-y-2">
              <p className="text-sm font-medium">1. Type de période</p>
              <div className="flex flex-wrap gap-2">
                {PERIODES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriode(p.id)}
                    aria-pressed={periode === p.id}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      periode === p.id
                        ? "bg-primary text-primary-foreground"
                        : "border border-input text-muted-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">2. Période concernée</p>
              <Calendrier valeur={jour} onSelection={setJour} plage={plage} />
              <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs">
                Période sélectionnée : <span className="font-semibold">{libellePlage(plage)}</span>
              </p>
            </div>

            <form onSubmit={creerBudget} className="space-y-3">
              <p className="text-sm font-medium">3. Dépense à prévoir</p>

              <div>
                <label htmlFor="b-situation" className="text-sm font-medium">
                  Situation (dépense existante)
                </label>
                <select
                  id="b-situation"
                  value={situation}
                  onChange={(ev) => setSituation(ev.target.value)}
                  className={champ}
                >
                  <option value="">— Choisir une dépense —</option>
                  {situations.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="__autre">Autre dépense…</option>
                </select>
              </div>

              {situation === "__autre" && (
                <div>
                  <label htmlFor="b-autre" className="text-sm font-medium">
                    Nommer la dépense
                  </label>
                  <input
                    id="b-autre"
                    value={autreSituation}
                    onChange={(ev) => setAutreSituation(ev.target.value)}
                    placeholder="Loyer, école, carburant…"
                    className={champ}
                  />
                </div>
              )}

              <div>
                <label htmlFor="b-enveloppe" className="text-sm font-medium">
                  Enveloppe de prélèvement
                </label>
                <select
                  id="b-enveloppe"
                  value={bEnveloppe}
                  onChange={(ev) => setBEnveloppe(ev.target.value)}
                  className={champ}
                >
                  {enveloppes.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.emoji} {e.nom}
                    </option>
                  ))}
                </select>
                {enveloppeChoisie && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Plafond de l'enveloppe : {formatFCFA(enveloppeChoisie.plafond)}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="b-montant" className="text-sm font-medium">
                  Montant prévu pour la période (FCFA)
                </label>
                <input
                  id="b-montant"
                  inputMode="numeric"
                  value={bMontant}
                  onChange={(ev) => setBMontant(ev.target.value.replace(/[^\d]/g, ""))}
                  placeholder="50000"
                  className={champ}
                />
              </div>

              <div>
                <label htmlFor="b-compte" className="text-sm font-medium">
                  Compte débité
                </label>
                <select
                  id="b-compte"
                  value={bCompte}
                  onChange={(ev) => setBCompte(ev.target.value)}
                  className={champ}
                >
                  {comptes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recurrent}
                  onChange={(ev) => setRecurrent(ev.target.checked)}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                Répéter à chaque période ({libellePeriode(periode).toLowerCase()})
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPopupOuvert(false)}
                  className="flex-1 rounded-xl border border-input py-3 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
                >
                  Prévoir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Confirmation
        ouvert={demande !== null}
        titre={
          demande?.type === "suppression"
            ? "Supprimer cette dépense prévue ?"
            : demande?.type === "creation"
              ? "Confirmer la prévision"
              : "Confirmer la conversion"
        }
        message={
          demande?.type === "suppression"
            ? `La dépense prévue « ${demande.libelle} » sera supprimée définitivement.`
            : demande?.type === "creation"
              ? `Prévoir « ${demande.libelle} » sur la période ${libellePlage({ debut: demande.debut, fin: demande.fin })} ?`
              : demande?.type === "conversion-un"
                ? `Créer une dépense réelle de ${formatFCFA(demande.montant)} pour « ${demande.libelle} » ?`
                : demande
                  ? `${demande.nb} échéance${demande.nb > 1 ? "s" : ""} seront converties en dépenses réelles pour un total de ${formatFCFA(demande.montant)}.`
                  : ""
        }
        details={
          demande?.type === "creation"
            ? [
                { label: "Dépense", avant: "—", apres: demande.libelle },
                {
                  label: "Période",
                  avant: libellePeriode(periode),
                  apres: libellePlage({ debut: demande.debut, fin: demande.fin }),
                },
                { label: "Montant", avant: "—", apres: formatFCFA(demande.montant) },
                {
                  label: "Enveloppe",
                  avant: "—",
                  apres: enveloppes.find((e) => e.id === demande.enveloppeId)?.nom ?? "—",
                },
                { label: "Compte débité", avant: "—", apres: demande.compte },
                {
                  label: "Répétition",
                  avant: "—",
                  apres: demande.ponctuel ? "Une seule fois" : `À chaque ${libellePeriode(periode).toLowerCase()}`,
                },
              ]
            : []
        }
        confirmerLabel={demande?.type === "suppression" ? "Supprimer" : "Confirmer"}
        danger={demande?.type === "suppression"}
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
