import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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

  /** Dépenses planifiées dont l'échéance tombe dans la période affichée. */
  const budgetsPeriode = budgets.filter((b) => {
    const j = (b.debut ?? b.prochaine).slice(0, 10);
    return b.periode === periode ? j >= plage.debut && j <= plage.fin || !b.debut : false;
  });
  const totalPeriode = budgetsPeriode.reduce((s, b) => s + b.montant, 0);
  const totalMensuel = budgets.reduce((s, b) => s + equivalentMensuel(b), 0);
  const dues = budgets.map((b) => ({ b, n: b.actif ? nombreEcheancesDues(b) : 0 }));
  const nbDues = dues.reduce((s, d) => s + d.n, 0);
  const montantDu = dues.reduce((s, d) => s + d.n * d.b.montant, 0);

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
      <BoutonRetour to="/enveloppes/" label="Retour aux enveloppes" />

      <section className="carte space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold">Budgétisation</h2>
          <p className="text-sm text-muted-foreground">
            Prévoyez une dépense existante sur une période précise : « cette semaine, tel montant
            pour telle situation, prélevé dans telle enveloppe ».
          </p>
        </div>

        {/* Étape 1 — type de période */}
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

        {/* Étape 2 — calendrier */}
        <div className="space-y-2">
          <p className="text-sm font-medium">2. Période concernée</p>
          <Calendrier valeur={jour} onSelection={setJour} plage={plage} />
          <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs">
            Période sélectionnée : <span className="font-semibold">{libellePlage(plage)}</span>
          </p>
        </div>

        {/* Étape 3 — la dépense (situation) */}
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

          <button
            type="submit"
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
          >
            Prévoir cette dépense
          </button>
        </form>

        <div className="rounded-xl bg-secondary/60 p-3 text-sm">
          <p className="font-semibold">
            Prévu sur la période : {formatFCFA(totalPeriode)}
          </p>
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

        {budgetsPeriode.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune dépense prévue pour cette période.
          </p>
        ) : (
          <ul className="space-y-2">
            {budgetsPeriode.map((b) => {
              const env = enveloppes.find((e) => e.id === b.enveloppeId);
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/70 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.libelle}</p>
                    <p className="text-xs text-muted-foreground">
                      {env ? `${env.emoji} ${env.nom}` : "Enveloppe supprimée"} ·{" "}
                      {libellePeriode(b.periode)} · {b.compte}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.debut && b.fin
                        ? `Période : ${libellePlage({ debut: b.debut, fin: b.fin })}`
                        : `Prochaine échéance : ${formatDateFr(b.prochaine)}`}
                      {b.ponctuel === false ? " · récurrente" : ""}
                    </p>
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
                      className="mt-1.5 rounded-lg border border-input px-2.5 py-1 text-xs font-medium"
                    >
                      Convertir maintenant
                    </button>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold">{formatFCFA(b.montant)}</span>
                    <button
                      type="button"
                      onClick={() => setDemande({ type: "suppression", id: b.id, libelle: b.libelle })}
                      aria-label={`Supprimer ${b.libelle}`}
                      className="rounded-lg border border-input px-2 py-1 text-xs text-destructive"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
                  champ: "Période",
                  avant: libellePeriode(periode),
                  apres: libellePlage({ debut: demande.debut, fin: demande.fin }),
                },
                { label: "Montant", avant: "—", apres: formatFCFA(demande.montant) },
                {
                  champ: "Enveloppe",
                  avant: "—",
                  apres: enveloppes.find((e) => e.id === demande.enveloppeId)?.nom ?? "—",
                },
                { label: "Compte débité", avant: "—", apres: demande.compte },
                {
                  champ: "Répétition",
                  avant: "—",
                  apres: demande.ponctuel ? "Une seule fois" : `À chaque ${libellePeriode(periode).toLowerCase()}`,
                },
              ]
            : undefined
        }
        confirmerLabel={demande?.type === "suppression" ? "Supprimer" : "Confirmer"}
        danger={demande?.type === "suppression"}
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
