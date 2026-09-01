import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, ChevronDown, Plus } from "lucide-react";
import { useSuperApp, type Periode } from "@/lib/store";
import { formatFCFA, formatDateFr, grouperMontant } from "@/lib/format";
import { nombreEcheancesDues, equivalentMensuel, libellePlage, avancerDate } from "@/lib/periodes";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { Calendrier, jourISO } from "@/components/Calendrier";
import { FicheSuiviBudget } from "@/components/FicheSuiviBudget";
import { SectionBudgetAuto } from "@/components/SectionBudgetAuto";

export const Route = createFileRoute("/enveloppes/budgetisation")({
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

  const search = useSearch({ from: Route.id }) as { onglet?: "plan" | "suivi" | "auto" };
  const [popupOuvert, setPopupOuvert] = useState(false);
  const [onglet, setOnglet] = useState<"plan" | "suivi" | "auto">(
    search.onglet ?? "plan",
  );
  const [ouverte, setOuverte] = useState<string | null>(null);

  useEffect(() => {
    if (search.onglet && ["plan", "suivi", "auto"].includes(search.onglet)) {
      setOnglet(search.onglet);
    }
  }, [search.onglet]);
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
        liste: liste
          .slice()
          .sort((a, z) => (a.debut ?? a.prochaine).localeCompare(z.debut ?? z.prochaine)),
        total: liste.reduce((s, b) => s + b.montant, 0),
      };
    });
  }, [budgets, enveloppes]);

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

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            { id: "plan", label: "Plan" },
            { id: "suivi", label: "Suivi du mois" },
            { id: "auto", label: "Proposition auto" },
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

      {onglet === "suivi" && <FicheSuiviBudget />}
      {onglet === "auto" && <SectionBudgetAuto />}

      <section className={onglet === "plan" ? "carte space-y-4 p-4" : "hidden"}>

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
              {nbDues} échéance{nbDues > 1 ? "s" : ""} à générer · {formatFCFA(montantDu)}
            </p>
            <button
              type="button"
              onClick={() =>
                setDemande({ type: "conversion-tout", nb: nbDues, montant: montantDu })
              }
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
                              <span className="text-muted-foreground">Périodicité : </span>
                              {libelleRepetition(b)}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Compte débité : </span>
                              {b.compte}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Prochaine échéance : </span>
                              {formatDateFr(b.prochaine)}
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

            <form onSubmit={creerBudget} className="space-y-4">
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
                {periodique === true && (
                  <p className="text-xs text-muted-foreground">
                    Les échéances suivantes seront calculées à partir de ce premier versement.
                  </p>
                )}
                <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs">
                  Période couverte :{" "}
                  <span className="font-semibold">{libellePlage({ debut, fin })}</span>
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
