import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CalendarDays, ChevronDown, Trash2 } from "lucide-react";
import { useSuperApp, type Periode } from "@/lib/store";
import { formatFCFA, grouperMontant } from "@/lib/format";
import { libellePlage, avancerDate } from "@/lib/periodes";
import { Confirmation } from "@/components/Confirmation";
import { Calendrier, jourISO } from "@/components/Calendrier";

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

/** Fréquences proposées, converties en période de base + intervalle. */
const FREQUENCES: { id: string; label: string; periode: Periode; intervalle: number }[] = [
  { id: "j1", label: "Journalière (chaque jour)", periode: "jour", intervalle: 1 },
  { id: "j2", label: "Tous les 2 jours", periode: "jour", intervalle: 2 },
  { id: "j3", label: "Tous les 3 jours", periode: "jour", intervalle: 3 },
  { id: "s1", label: "Hebdomadaire (chaque semaine)", periode: "semaine", intervalle: 1 },
  { id: "s2", label: "Toutes les 2 semaines", periode: "semaine", intervalle: 2 },
  { id: "m1", label: "Mensuelle (chaque mois)", periode: "mois", intervalle: 1 },
  { id: "m2", label: "Tous les 2 mois", periode: "mois", intervalle: 2 },
  { id: "t1", label: "Trimestrielle (3 mois)", periode: "trimestre", intervalle: 1 },
  { id: "se1", label: "Semestrielle (6 mois)", periode: "semestre", intervalle: 1 },
  { id: "a1", label: "Annuelle (chaque année)", periode: "annee", intervalle: 1 },
  { id: "a2", label: "Tous les 2 ans", periode: "annee", intervalle: 2 },
];

/** Durée sur laquelle s'étend la périodicité. */
const DUREES: { id: string; label: string; jours?: number; mois?: number }[] = [
  { id: "1sem", label: "1 semaine", jours: 7 },
  { id: "2sem", label: "2 semaines", jours: 14 },
  { id: "1m", label: "1 mois", mois: 1 },
  { id: "2m", label: "2 mois", mois: 2 },
  { id: "3m", label: "3 mois", mois: 3 },
  { id: "6m", label: "6 mois", mois: 6 },
  { id: "1a", label: "1 an", mois: 12 },
  { id: "2a", label: "2 ans", mois: 24 },
];

function finDepuis(debut: string, dureeId: string): string {
  const d = DUREES.find((x) => x.id === dureeId);
  const date = new Date(`${debut}T12:00:00`);
  if (d?.jours) date.setDate(date.getDate() + d.jours);
  if (d?.mois) date.setMonth(date.getMonth() + d.mois);
  date.setDate(date.getDate() - 1);
  return jourISO(date);
}

/** Nombre d'échéances produites entre le premier versement et la fin de l'étendue. */
function nombreOccurrences(
  debut: string,
  fin: string,
  periode: Periode,
  intervalle: number,
): number {
  let n = 0;
  let courant = new Date(`${debut}T12:00:00`).toISOString();
  while (jourISO(new Date(courant)) <= fin && n < 500) {
    n += 1;
    courant = avancerDate(courant, periode, intervalle);
  }
  return n;
}

const FMT_LONG = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function jourLong(iso: string): string {
  return FMT_LONG.format(new Date(`${iso}T12:00:00`));
}

/**
 * Formulaire pleine page d'une dépense planifiée.
 * Sans `budgetId` il crée une nouvelle prévision ; avec `budgetId` il modifie
 * ou supprime la prévision existante, puis revient au plan des dépenses.
 */
export function FormulaireBudget({ budgetId }: { budgetId?: string }) {
  const {
    enveloppes,
    budgets,
    comptes,
    transactions,
    ajouterBudget,
    modifierBudget,
    supprimerBudget,
  } = useSuperApp();
  const navigate = useNavigate();
  const existant = budgetId ? budgets.find((b) => b.id === budgetId) : undefined;

  const [sujet, setSujet] = useState(existant?.libelle ?? "");
  const [periodique, setPeriodique] = useState<boolean | null>(
    existant ? existant.ponctuel === false : null,
  );
  const [frequenceId, setFrequenceId] = useState(
    existant
      ? (FREQUENCES.find(
          (f) => f.periode === existant.periode && f.intervalle === (existant.intervalle ?? 1),
        )?.id ?? "")
      : "",
  );
  const [bMontant, setBMontant] = useState(existant ? String(existant.montant) : "");
  const [bEnveloppe, setBEnveloppe] = useState(existant?.enveloppeId ?? enveloppes[0]?.id ?? "");
  const [bCompte, setBCompte] = useState(existant?.compte ?? comptes[0] ?? "");
  const [dureeId, setDureeId] = useState("");
  const [debut, setDebut] = useState(
    () =>
      existant?.debut ?? (existant ? jourISO(new Date(existant.prochaine)) : jourISO(new Date())),
  );
  const [calendrierOuvert, setCalendrierOuvert] = useState(false);
  const [demande, setDemande] = useState<null | { type: "enregistrer" | "suppression" }>(null);

  const frequence = FREQUENCES.find((f) => f.id === frequenceId);
  const duree = DUREES.find((d) => d.id === dureeId);
  const fin = periodique && duree ? finDepuis(debut, dureeId) : (existant?.fin ?? debut);
  const occurrencesPrevues =
    periodique && frequence && duree
      ? nombreOccurrences(debut, fin, frequence.periode, frequence.intervalle)
      : 1;

  /** Dépenses déjà existantes dans l'application, proposées comme sujets. */
  const sujets = useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions)
      if (t.type === "depense" && t.libelle.trim()) set.add(t.libelle.trim());
    for (const b of budgets) if (b.libelle.trim()) set.add(b.libelle.trim());
    return Array.from(set).sort((a, z) => a.localeCompare(z, "fr"));
  }, [transactions, budgets]);

  const enveloppeChoisie = enveloppes.find((e) => e.id === bEnveloppe);
  const montant = Number(bMontant);

  function valider(ev: React.FormEvent): void {
    ev.preventDefault();
    const erreur = !sujet.trim()
      ? "Indiquez le sujet de votre dépense."
      : periodique === null
        ? "Précisez si votre dépense est périodique."
        : periodique && !frequence
          ? "Choisissez la périodicité de cette dépense."
          : !Number.isFinite(montant) || montant <= 0
            ? "Montant invalide : saisissez un montant positif en FCFA."
            : !bEnveloppe || !enveloppes.some((e) => e.id === bEnveloppe)
              ? "Choisissez l'enveloppe de prélèvement."
              : !bCompte
                ? "Choisissez le compte à débiter."
                : periodique && !duree && !existant
                  ? "Précisez sur quel temps s'étend la périodicité."
                  : !debut
                    ? "Choisissez le jour de la dépense."
                    : !existant && debut < jourISO(new Date())
                      ? "Le jour de la dépense ne peut pas être dans le passé."
                      : periodique && frequence && duree && occurrencesPrevues < 2
                        ? "Incohérence : cette combinaison ne produit qu'une seule échéance. Choisissez une étendue plus longue ou une fréquence plus rapprochée."
                        : "";
    if (erreur) {
      toast.error(erreur);
      return;
    }
    setDemande({ type: "enregistrer" });
  }

  function confirmer() {
    if (!demande) return;
    if (demande.type === "suppression" && existant) {
      supprimerBudget(existant.id);
      toast.success("Dépense planifiée supprimée.");
    } else {
      const donnees = {
        libelle: sujet.trim(),
        enveloppeId: bEnveloppe,
        montant,
        compte: bCompte,
        prochaine: new Date(`${debut}T08:00:00`).toISOString(),
        debut,
        fin,
        ponctuel: !periodique,
        periode: frequence?.periode ?? "jour",
        intervalle: frequence?.intervalle ?? 1,
      } as const;
      if (existant) {
        modifierBudget(existant.id, donnees);
        toast.success("Dépense planifiée modifiée.");
      } else {
        ajouterBudget({ ...donnees, actif: true });
        toast.success("Dépense prévue.");
      }
    }
    setDemande(null);
    void navigate({ to: "/budget/plan" });
  }

  if (budgetId && !existant) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Dépense planifiée introuvable</h1>
        <p className="text-sm text-muted-foreground">
          Cette prévision n'existe plus. Revenez au plan des dépenses.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">
        {existant ? "Modifier une dépense planifiée" : "Planifier une dépense"}
      </h1>

      <form onSubmit={valider} className="carte space-y-4 p-4">
        <div>
          <label htmlFor="b-sujet" className="text-sm font-medium">
            Quel est le sujet de votre dépense ?
          </label>
          <input
            id="b-sujet"
            list="b-sujets"
            value={sujet}
            onChange={(ev) => setSujet(ev.target.value)}
            placeholder="Loyer, école, carburant…"
            className={champ}
          />
          <datalist id="b-sujets">
            {sujets.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div>
          <p className="text-sm font-medium">Votre dépense est-elle périodique ?</p>
          <div className="mt-1.5 flex gap-2">
            {[
              { v: true, l: "Oui" },
              { v: false, l: "Non" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => setPeriodique(o.v)}
                aria-pressed={periodique === o.v}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${
                  periodique === o.v
                    ? "bg-primary text-primary-foreground"
                    : "border border-input text-muted-foreground"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {periodique === true && (
          <div>
            <label htmlFor="b-frequence" className="text-sm font-medium">
              Quelle est la périodicité de cette dépense ?
            </label>
            <select
              id="b-frequence"
              value={frequenceId}
              onChange={(ev) => setFrequenceId(ev.target.value)}
              className={champ}
            >
              <option value="">— Choisir une fréquence —</option>
              {FREQUENCES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="b-montant" className="text-sm font-medium">
            Quel est le montant de la dépense ? (FCFA)
          </label>
          <input
            id="b-montant"
            inputMode="numeric"
            value={grouperMontant(bMontant)}
            onChange={(ev) => setBMontant(ev.target.value.replace(/[^\d]/g, ""))}
            placeholder="50000"
            className={champ}
          />
        </div>

        <div>
          <label htmlFor="b-enveloppe" className="text-sm font-medium">
            Dans quelle enveloppe souhaitez-vous prélever les sous ?
          </label>
          <select
            id="b-enveloppe"
            value={bEnveloppe}
            onChange={(ev) => setBEnveloppe(ev.target.value)}
            className={champ}
          >
            <option value="">— Choisir une enveloppe —</option>
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
          <label htmlFor="b-compte" className="text-sm font-medium">
            Dans quel compte voulez-vous puiser cette somme ?
          </label>
          <select
            id="b-compte"
            value={bCompte}
            onChange={(ev) => setBCompte(ev.target.value)}
            className={champ}
          >
            <option value="">— Choisir un compte —</option>
            {comptes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {periodique === true && (
          <div>
            <label htmlFor="b-duree" className="text-sm font-medium">
              Sur quel temps doit s'étendre la périodicité de cette dépense ?
            </label>
            <select
              id="b-duree"
              value={dureeId}
              onChange={(ev) => setDureeId(ev.target.value)}
              className={champ}
            >
              <option value="">— Choisir une durée —</option>
              {DUREES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">
            {periodique === true
              ? "Quel est le jour de la première dépense ?"
              : "Quel jour aura lieu cette dépense ?"}
          </p>
          <button
            type="button"
            onClick={() => setCalendrierOuvert((v) => !v)}
            aria-expanded={calendrierOuvert}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-background/60 px-3 py-2.5 text-left text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarDays aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{jourLong(debut)}</span>
            </span>
            <ChevronDown
              aria-hidden
              className={`h-4 w-4 shrink-0 transition-transform ${calendrierOuvert ? "rotate-180" : ""}`}
            />
          </button>
          {calendrierOuvert && (
            <Calendrier
              valeur={debut}
              onSelection={(j) => {
                setDebut(j);
                setCalendrierOuvert(false);
              }}
              plage={{ debut, fin }}
            />
          )}
          <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs">
            Période couverte : <span className="font-semibold">{libellePlage({ debut, fin })}</span>
            {periodique === true && frequence && duree && (
              <>
                {" · "}
                <span className="font-semibold">
                  {occurrencesPrevues} échéance{occurrencesPrevues > 1 ? "s" : ""}
                </span>
              </>
            )}
          </p>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
        >
          {existant ? "Enregistrer les modifications" : "Prévoir"}
        </button>
      </form>

      {existant && (
        <button
          type="button"
          onClick={() => setDemande({ type: "suppression" })}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/50 py-3 text-sm font-semibold text-destructive"
        >
          <Trash2 aria-hidden className="h-4 w-4" />
          Supprimer cette dépense planifiée
        </button>
      )}

      <Confirmation
        ouvert={demande !== null}
        titre={
          demande?.type === "suppression"
            ? "Supprimer cette dépense prévue ?"
            : existant
              ? "Confirmer la modification"
              : "Confirmer la prévision"
        }
        message={
          demande?.type === "suppression"
            ? `La dépense prévue « ${existant?.libelle ?? ""} » sera supprimée définitivement.`
            : `${sujet.trim()} · ${formatFCFA(montant || 0)} à partir du ${jourLong(debut)}.`
        }
        details={
          demande?.type === "enregistrer"
            ? [
                {
                  label: "Sujet de la dépense",
                  avant: existant?.libelle ?? "—",
                  apres: sujet.trim(),
                },
                {
                  label: "Montant par échéance",
                  avant: existant ? formatFCFA(existant.montant) : "—",
                  apres: formatFCFA(montant || 0),
                },
                { label: "Périodique", avant: "—", apres: periodique ? "Oui" : "Non" },
                ...(periodique && frequence
                  ? [{ label: "Fréquence", avant: "—", apres: frequence.label }]
                  : []),
                {
                  label: "Enveloppe",
                  avant: "—",
                  apres: enveloppeChoisie?.nom ?? "—",
                },
                { label: "Compte débité", avant: existant?.compte ?? "—", apres: bCompte },
                {
                  label: "Période couverte",
                  avant: "—",
                  apres: libellePlage({ debut, fin }),
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
