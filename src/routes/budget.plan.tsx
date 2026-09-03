import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useSuperApp, type Periode } from "@/lib/store";
import { formatFCFA, formatDateFr, grouperMontant } from "@/lib/format";
import { nombreEcheancesDues, equivalentMensuel, libellePlage, avancerDate } from "@/lib/periodes";
import { Confirmation } from "@/components/Confirmation";
import { Calendrier, jourISO } from "@/components/Calendrier";
import { AXES_PLAN } from "@/components/ListePlansGroupes";

export const Route = createFileRoute("/budget/plan")({
  head: () => ({
    meta: [
      { title: "Budgétisation — Prévoir vos dépenses par période en FCFA" },
      {
        name: "description",
        content:
          "Planifiez une dépense en répondant à quelques questions : sujet, périodicité, fréquence, montant, enveloppe, compte et durée, en francs CFA.",
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
        periode: Periode;
        intervalle: number;
        frequenceLabel: string;
        dureeLabel: string;
        occurrences: number;
      }
    | { type: "conversion-tout"; nb: number; montant: number }
    | { type: "conversion-un"; id: string; libelle: string; montant: number }
    | { type: "suppression"; id: string; libelle: string }
    | null;
  const [demande, setDemande] = useState<Demande>(null);

  const [popupOuvert, setPopupOuvert] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [calendrierOuvert, setCalendrierOuvert] = useState(false);

  // Réponses du questionnaire
  const [sujet, setSujet] = useState("");
  const [periodique, setPeriodique] = useState<boolean | null>(null);
  const [frequenceId, setFrequenceId] = useState("");
  const [bMontant, setBMontant] = useState("");
  const [bEnveloppe, setBEnveloppe] = useState(enveloppes[0]?.id ?? "");
  const [bCompte, setBCompte] = useState(comptes[0] ?? "");
  const [dureeId, setDureeId] = useState("");
  const [debut, setDebut] = useState(() => jourISO(new Date()));

  const frequence = FREQUENCES.find((f) => f.id === frequenceId);
  const duree = DUREES.find((d) => d.id === dureeId);
  const fin = periodique && duree ? finDepuis(debut, duree.id) : debut;
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

  const totalMensuel = budgets.reduce((s, b) => s + equivalentMensuel(b), 0);
  const dues = budgets.map((b) => ({ b, n: b.actif ? nombreEcheancesDues(b) : 0 }));
  const nbDues = dues.reduce((s, d) => s + d.n, 0);
  const montantDu = dues.reduce((s, d) => s + d.n * d.b.montant, 0);

  function nomEnveloppe(id: string): string {
    const env = enveloppes.find((e) => e.id === id);
    return env ? `${env.emoji} ${env.nom}` : "Enveloppe supprimée";
  }

  const MOIS_FR = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

  /** Regroupement des dépenses planifiées selon l'axe choisi. */
  function grouper(axe: "mois" | "enveloppe" | "libelle") {
    const map = new Map<string, { nom: string; liste: typeof budgets }>();
    for (const b of budgets) {
      let cle = "";
      let nom = "";
      if (axe === "enveloppe") {
        cle = b.enveloppeId || "__sans";
        nom = nomEnveloppe(b.enveloppeId);
      } else if (axe === "libelle") {
        cle = b.libelle.trim().toLowerCase() || "__sans";
        nom = b.libelle.trim() || "Sans libellé";
      } else {
        const iso = b.debut ?? b.prochaine;
        const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
        cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        nom = MOIS_FR.format(d);
      }
      const g = map.get(cle) ?? { nom, liste: [] as typeof budgets };
      g.liste.push(b);
      map.set(cle, g);
    }
    return Array.from(map.entries())
      .sort((a, z) =>
        axe === "mois" ? a[0].localeCompare(z[0]) : a[1].nom.localeCompare(z[1].nom, "fr"),
      )
      .map(([id, g]) => ({
        id,
        nom: g.nom,
        liste: g.liste
          .slice()
          .sort((a, z) => (a.debut ?? a.prochaine).localeCompare(z.debut ?? z.prochaine)),
        total: g.liste.reduce((s, b) => s + b.montant, 0),
      }));
  }

  const [axe, setAxe] = useState<"mois" | "enveloppe" | "libelle" | null>(null);
  const groupes = useMemo(
    () => (axe ? grouper(axe) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [axe, budgets, enveloppes],
  );

  const totalPlanifie = budgets.reduce((s, b) => s + b.montant, 0);
  const enveloppeChoisie = enveloppes.find((e) => e.id === bEnveloppe);

  function libelleRepetition(b: { periode: Periode; intervalle?: number; ponctuel?: boolean }) {
    if (b.ponctuel !== false) return "Une seule fois";
    const f = FREQUENCES.find(
      (x) => x.periode === b.periode && x.intervalle === (b.intervalle ?? 1),
    );
    return f ? f.label : b.periode;
  }

  function creerBudget(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = Number(bMontant);
    if (!sujet.trim()) {
      toast.error("Indiquez le sujet de votre dépense.");
      return;
    }
    if (periodique === null) {
      toast.error("Précisez si votre dépense est périodique.");
      return;
    }
    if (periodique && !frequence) {
      toast.error("Choisissez la périodicité de cette dépense.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur <= 0) {
      toast.error("Montant invalide : saisissez un montant positif en FCFA.");
      return;
    }
    if (!bEnveloppe || !enveloppes.some((e) => e.id === bEnveloppe)) {
      toast.error("Choisissez l'enveloppe de prélèvement.");
      return;
    }
    if (!bCompte) {
      toast.error("Choisissez le compte à débiter.");
      return;
    }
    if (periodique && !duree) {
      toast.error("Précisez sur quel temps s'étend la périodicité.");
      return;
    }
    if (!debut) {
      toast.error(
        periodique
          ? "Choisissez le jour de la première dépense."
          : "Choisissez le jour de la dépense.",
      );
      return;
    }
    if (debut < jourISO(new Date())) {
      toast.error(
        periodique
          ? "Le jour de la première dépense ne peut pas être dans le passé."
          : "Le jour de la dépense ne peut pas être dans le passé.",
      );
      return;
    }
    if (periodique && frequence && duree && occurrencesPrevues < 2) {
      toast.error(
        `Incohérence : « ${frequence.label} » sur ${duree.label} à partir du ${jourLong(debut)} ne produit qu'une seule échéance. Choisissez une étendue plus longue ou une fréquence plus rapprochée.`,
      );
      return;
    }
    setDemande({
      type: "creation",
      libelle: sujet.trim(),
      enveloppeId: bEnveloppe,
      montant: valeur,
      compte: bCompte,
      prochaine: new Date(`${debut}T08:00:00`).toISOString(),
      debut,
      fin,
      ponctuel: !periodique,
      periode: frequence?.periode ?? "jour",
      intervalle: frequence?.intervalle ?? 1,
      frequenceLabel: periodique ? (frequence?.label ?? "—") : "Aucune (dépense unique)",
      dureeLabel: periodique ? (duree?.label ?? "—") : "Une seule échéance",
      occurrences: periodique ? occurrencesPrevues : 1,
    });
  }

  function confirmer() {
    if (!demande) return;
    if (demande.type === "creation") {
      ajouterBudget({
        libelle: demande.libelle,
        enveloppeId: demande.enveloppeId,
        montant: demande.montant,
        periode: demande.periode,
        intervalle: demande.intervalle,
        compte: demande.compte,
        prochaine: demande.prochaine,
        debut: demande.debut,
        fin: demande.fin,
        ponctuel: demande.ponctuel,
        actif: true,
      });
      setSujet("");
      setPeriodique(null);
      setFrequenceId("");
      setDureeId("");
      setBMontant("");
      setPopupOuvert(false);
      toast.success("Dépense prévue.");
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
        <Link
          to="/budget/planifier"
          className="inline-flex items-center gap-1 rounded-xl bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" />
          Planifier une dépense
        </Link>
      </div>

      <section className="carte space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold">Budgétisation</h2>
          <p className="text-sm text-muted-foreground">
            Prévoyez vos dépenses en répondant à quelques questions simples.
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
              {nbDues} dépense{nbDues > 1 ? "s" : ""} à confirmer · {formatFCFA(montantDu)}
            </p>
            <Link
              to="/budget/confirmations"
              className="mt-2 block w-full rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground"
            >
              Confirmer ces dépenses
            </Link>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Dépenses planifiées à venir</h3>
          {budgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune dépense planifiée. Utilisez « Planifier une dépense ».
            </p>
          ) : (
            AXES_PLAN.map((bande) => (
              <Link
                key={bande.id}
                to="/budget/plan-par/$axe"
                params={{ axe: bande.id }}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/70 bg-secondary/50 px-3 py-3 text-left transition-colors hover:bg-accent/30"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{bande.titre}</span>
                  <span className="block text-xs text-muted-foreground">{bande.desc}</span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0" />
              </Link>
            ))
          )}
        </div>
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
              ? demande.ponctuel
                ? `Prévoir « ${demande.libelle} » le ${jourLong(demande.debut)} ?`
                : `Premier versement le ${jourLong(demande.debut)}, puis ${demande.frequenceLabel.toLowerCase()} pendant ${demande.dureeLabel} : ${demande.occurrences} échéances de ${formatFCFA(demande.montant)}.`
              : demande?.type === "conversion-un"
                ? `Créer une dépense réelle de ${formatFCFA(demande.montant)} pour « ${demande.libelle} » ?`
                : demande
                  ? `${demande.nb} échéance${demande.nb > 1 ? "s" : ""} seront converties en dépenses réelles pour un total de ${formatFCFA(demande.montant)}.`
                  : ""
        }
        details={
          demande?.type === "creation"
            ? [
                { label: "Sujet de la dépense", avant: "—", apres: demande.libelle },
                {
                  label: demande.ponctuel ? "Jour de la dépense" : "1er versement",
                  avant: "—",
                  apres: jourLong(demande.debut),
                },
                { label: "Montant par échéance", avant: "—", apres: formatFCFA(demande.montant) },
                { label: "Périodique", avant: "—", apres: demande.ponctuel ? "Non" : "Oui" },
                ...(demande.ponctuel
                  ? []
                  : [
                      { label: "Fréquence", avant: "—", apres: demande.frequenceLabel },
                      { label: "Étendue", avant: "—", apres: demande.dureeLabel },
                      {
                        label: "Nombre d'échéances",
                        avant: "—",
                        apres: String(demande.occurrences),
                      },
                      {
                        label: "Total de la série",
                        avant: "—",
                        apres: formatFCFA(demande.montant * demande.occurrences),
                      },
                    ]),
                {
                  label: "Enveloppe",
                  avant: "—",
                  apres: enveloppes.find((e) => e.id === demande.enveloppeId)?.nom ?? "—",
                },
                { label: "Compte débité", avant: "—", apres: demande.compte },
                {
                  label: "Période couverte",
                  avant: "—",
                  apres: libellePlage({ debut: demande.debut, fin: demande.fin }),
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
