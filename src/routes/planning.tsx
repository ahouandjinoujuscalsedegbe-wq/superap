import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ClipboardCopy,
  Download,
  History,
  Lightbulb,
  Plus,
  Printer,
  SkipForward,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, grouperMontant, deGrouperMontant } from "@/lib/format";
import { telechargerFichier } from "@/lib/journal";
import {
  alarmesComptes,
  alarmesPlafonds,
  lireReglagesAlarme,
  REGLAGES_ALARME_DEFAUT,
  type ReglagesAlarme,
} from "@/lib/alarme";
import {
  construirePlanning,
  ecrirePrefsPlanning,
  ecrireRevenusPrevus,
  HORIZONS,
  lirePrefsPlanning,
  lireRevenusPrevus,
  NB_SEMAINES,
  planningEnCsv,
  planningEnTexte,
  PREFS_DEFAUT,
  type Echeance,
  type PrefsPlanning,
  type RevenuPrevu,
  type SemainePlanning,
} from "@/lib/planning";

export const Route = createFileRoute("/planning")({
  head: () => ({
    meta: [
      { title: "Planning 14 semaines — Budget familial FCFA" },
      {
        name: "description",
        content:
          "Visualisez vos prochaines semaines : revenus attendus, dépenses planifiées, soldes projetés, écarts réel vs prévu et semaines à risque.",
      },
      { property: "og:title", content: "Planning 14 semaines" },
      {
        property: "og:description",
        content:
          "Projection semaine par semaine de vos revenus, dépenses planifiées et soldes d'enveloppes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PagePlanning,
});

function jourCourt(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function ajouterJours(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

type ActionEcheance =
  { genre: "payer"; echeance: Echeance } | { genre: "reporter"; echeance: Echeance };

function PagePlanning() {
  const {
    budgets,
    transactions,
    enveloppes,
    depensesParEnveloppe,
    solde,
    comptes,
    convertirBudget,
    modifierBudget,
    ajouterTransaction,
    soldesParCompte,
  } = useSuperApp();

  // Réglages d'alarme lus côté navigateur (seuils de comptes, plafonds).
  const [reglagesAlarme, setReglagesAlarme] = useState<ReglagesAlarme>(REGLAGES_ALARME_DEFAUT);
  useEffect(() => setReglagesAlarme(lireReglagesAlarme()), []);

  /** Alarmes de suivi affichées dans l'agenda : seuils de compte et plafonds. */
  const alarmesAgenda = useMemo(
    () => [
      ...alarmesComptes(soldesParCompte, reglagesAlarme.seuilsComptes),
      ...(reglagesAlarme.plafonds ? alarmesPlafonds(enveloppes, depensesParEnveloppe) : []),
    ],
    [soldesParCompte, depensesParEnveloppe, enveloppes, reglagesAlarme],
  );

  const [prefs, setPrefs] = useState<PrefsPlanning>(PREFS_DEFAUT);
  const [revenusPrevus, setRevenusPrevus] = useState<RevenuPrevu[]>([]);
  const [ouverte, setOuverte] = useState<number | null>(1);
  const [voirPassees, setVoirPassees] = useState(false);
  const [action, setAction] = useState<ActionEcheance | null>(null);
  const [revenuASupprimer, setRevenuASupprimer] = useState<RevenuPrevu | null>(null);

  // Popup revenu exceptionnel
  const [popupRevenu, setPopupRevenu] = useState<{ debut: string } | null>(null);
  const [rLibelle, setRLibelle] = useState("");
  const [rMontant, setRMontant] = useState("");
  const [rDate, setRDate] = useState("");
  const [confirmRevenu, setConfirmRevenu] = useState(false);

  // Popup saisie rapide d'une dépense de la semaine
  const [popupDepense, setPopupDepense] = useState<SemainePlanning | null>(null);
  const [dLibelle, setDLibelle] = useState("");
  const [dMontant, setDMontant] = useState("");
  const [dDate, setDDate] = useState("");
  const [dEnveloppe, setDEnveloppe] = useState("");
  const [dCompte, setDCompte] = useState("");
  const [confirmDepense, setConfirmDepense] = useState(false);

  useEffect(() => {
    setPrefs(lirePrefsPlanning());
    setRevenusPrevus(lireRevenusPrevus());
  }, []);

  function majPrefs(p: Partial<PrefsPlanning>) {
    setPrefs((ancien) => {
      const suivant = { ...ancien, ...p };
      ecrirePrefsPlanning(suivant);
      return suivant;
    });
  }

  function majRevenus(liste: RevenuPrevu[]) {
    setRevenusPrevus(liste);
    ecrireRevenusPrevus(liste);
  }

  const planning = useMemo(() => {
    const parId: Record<string, number> = {};
    for (const e of enveloppes) {
      parId[e.id] = depensesParEnveloppe[e.nom] ?? depensesParEnveloppe[e.id] ?? 0;
    }
    return construirePlanning({
      budgets,
      transactions,
      enveloppes,
      depensesParEnveloppe: parId,
      soldeActuel: solde,
      nbSemaines: prefs.horizon,
      depart: prefs.depart ?? undefined,
      filtreEnveloppeId: prefs.filtreEnveloppeId,
      revenusPrevus,
    });
  }, [budgets, transactions, enveloppes, depensesParEnveloppe, solde, prefs, revenusPrevus]);

  const maxi = Math.max(
    1,
    ...planning.semaines.map((s) => Math.max(s.depensesPrevues, s.revenusAttendus)),
  );

  function ouvrirPopupRevenu(debut: string) {
    setRLibelle("");
    setRMontant("");
    setRDate(debut);
    setPopupRevenu({ debut });
  }

  function ouvrirPopupDepense(s: SemainePlanning) {
    setDLibelle("");
    setDMontant(String(Math.round(s.depensesPrevues) || ""));
    setDDate(s.courante ? new Date().toISOString().slice(0, 10) : s.debut);
    setDEnveloppe(s.echeances[0]?.budget.enveloppeId ?? enveloppes[0]?.id ?? "");
    setDCompte(s.echeances[0]?.budget.compte ?? comptes[0] ?? "");
    setPopupDepense(s);
  }

  function validerAction() {
    if (!action) return;
    if (action.genre === "payer") {
      convertirBudget(action.echeance.budget.id, 1);
      toast.success("Échéance convertie en dépense réelle.");
    } else {
      const nouvelle = ajouterJours(action.echeance.date, 7);
      modifierBudget(action.echeance.budget.id, { prochaine: nouvelle });
      toast.success(`Échéance reportée au ${jourCourt(nouvelle)}.`);
    }
    setAction(null);
  }

  function enregistrerRevenu() {
    const montant = Number(rMontant);
    if (!rLibelle.trim() || !Number.isFinite(montant) || montant <= 0 || !rDate) {
      toast.error("Renseignez un libellé, un montant positif et une date.");
      return;
    }
    majRevenus([
      ...revenusPrevus,
      {
        id: `rev-${Date.now()}`,
        libelle: rLibelle.trim(),
        montant,
        date: rDate,
      },
    ]);
    setConfirmRevenu(false);
    setPopupRevenu(null);
    toast.success("Revenu exceptionnel ajouté au planning.");
  }

  function enregistrerDepense() {
    const montant = Number(dMontant);
    const env = enveloppes.find((e) => e.id === dEnveloppe);
    if (!dLibelle.trim() || !Number.isFinite(montant) || montant <= 0 || !dDate || !env) {
      toast.error("Renseignez un libellé, un montant positif, une date et une enveloppe.");
      return;
    }
    ajouterTransaction({
      type: "depense",
      montant,
      libelle: dLibelle.trim(),
      categorie: env.nom,
      compte: dCompte || comptes[0] || "",
      date: new Date(`${dDate}T12:00:00`).toISOString(),
    });
    setConfirmDepense(false);
    setPopupDepense(null);
    toast.success("Dépense enregistrée.");
  }

  function copierRapport() {
    const texte = planningEnTexte(planning);
    void navigator.clipboard
      ?.writeText(texte)
      .then(() => toast.success("Planning copié."))
      .catch(() => toast.error("Copie impossible."));
  }

  return (
    <div className="space-y-4">
      <BoutonRetour to="/" label="Retour à l'accueil" />

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <CalendarRange aria-hidden className="h-5 w-5 text-primary" />
          Planning de {planning.semaines.length} semaines
        </h1>
        <p className="text-sm text-muted-foreground">
          Projection de vos revenus attendus, dépenses planifiées et soldes semaine après semaine.
        </p>
      </header>

      {alarmesAgenda.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle aria-hidden className="h-4 w-4" /> Alarmes du jour (
            {alarmesAgenda.length})
          </h2>
          <ul className="space-y-1.5">
            {alarmesAgenda.map((a) => (
              <li key={a.id} className="rounded-xl bg-card/70 p-2">
                <p className="text-sm font-medium">{a.titre}</p>
                <p className="text-xs text-muted-foreground">{a.texte}</p>
                <p className="text-[11px] text-muted-foreground">
                  {a.date} · {a.type === "compte" ? "Seuil de compte" : "Plafond d'enveloppe"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 1 & 2 & 3 — réglages du planning */}
      <section className="space-y-2 rounded-2xl border border-input bg-card p-3">
        <h2 className="text-sm font-semibold">Réglages</h2>
        <div className="flex flex-wrap gap-1.5">
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => majPrefs({ horizon: h })}
              className={`rounded-full px-3 py-1 text-xs ${
                prefs.horizon === h
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent/40 text-foreground"
              }`}
            >
              {h} semaines
            </button>
          ))}
          <button
            type="button"
            onClick={() => majPrefs({ condense: !prefs.condense })}
            className="rounded-full bg-accent/40 px-3 py-1 text-xs"
          >
            {prefs.condense ? "Vue détaillée" : "Vue condensée"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Date de départ</span>
            <input
              type="date"
              value={prefs.depart ?? ""}
              onChange={(e) => majPrefs({ depart: e.target.value || null })}
              className="w-full rounded-xl border border-input bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Filtrer par enveloppe</span>
            <select
              value={prefs.filtreEnveloppeId ?? ""}
              onChange={(e) => majPrefs({ filtreEnveloppeId: e.target.value || null })}
              className="w-full rounded-xl border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Toutes les enveloppes</option>
              {enveloppes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.emoji} {e.nom}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Carte
          titre="Dépenses prévues"
          valeur={formatFCFA(planning.totalPrevu)}
          icone={<TrendingDown aria-hidden className="h-4 w-4 text-destructive" />}
        />
        <Carte
          titre="Revenus attendus"
          valeur={formatFCFA(planning.totalRevenus)}
          icone={<TrendingUp aria-hidden className="h-4 w-4 text-primary" />}
        />
        <Carte
          titre="Revenu hebdo moyen"
          valeur={formatFCFA(planning.revenuHebdoMoyen)}
          icone={<CalendarRange aria-hidden className="h-4 w-4 text-muted-foreground" />}
        />
        <Carte
          titre={`Solde projeté à S${planning.semaines.length || NB_SEMAINES}`}
          valeur={formatFCFA(planning.soldeFinal)}
          alerte={planning.soldeFinal < 0}
          icone={<TrendingUp aria-hidden className="h-4 w-4 text-muted-foreground" />}
        />
      </section>

      {/* 10 — export du planning */}
      <section className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={copierRapport}
          className="flex items-center gap-1 rounded-full bg-accent/40 px-3 py-1 text-xs"
        >
          <ClipboardCopy aria-hidden className="h-3.5 w-3.5" /> Copier
        </button>
        <button
          type="button"
          onClick={() =>
            telechargerFichier("planning.csv", planningEnCsv(planning), "text/csv;charset=utf-8")
          }
          className="flex items-center gap-1 rounded-full bg-accent/40 px-3 py-1 text-xs"
        >
          <Download aria-hidden className="h-3.5 w-3.5" /> CSV
        </button>
        <button
          type="button"
          onClick={() =>
            telechargerFichier(
              "planning.txt",
              planningEnTexte(planning),
              "text/plain;charset=utf-8",
            )
          }
          className="flex items-center gap-1 rounded-full bg-accent/40 px-3 py-1 text-xs"
        >
          <Download aria-hidden className="h-3.5 w-3.5" /> Texte
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1 rounded-full bg-accent/40 px-3 py-1 text-xs"
        >
          <Printer aria-hidden className="h-3.5 w-3.5" /> PDF (impression)
        </button>
      </section>

      {/* 6 — revenus exceptionnels */}
      <section className="space-y-2 rounded-2xl border border-input bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Revenus exceptionnels planifiés</h2>
          <button
            type="button"
            onClick={() => ouvrirPopupRevenu(planning.semaines[0]?.debut ?? "")}
            className="flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground"
          >
            <Plus aria-hidden className="h-3.5 w-3.5" /> Ajouter
          </button>
        </div>
        {revenusPrevus.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucun revenu exceptionnel prévu (prime, vente, aide…).
          </p>
        ) : (
          <ul className="space-y-1 text-xs">
            {[...revenusPrevus]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-accent/20 px-2 py-1"
                >
                  <span className="min-w-0 truncate">
                    {jourCourt(r.date)} · {r.libelle}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-medium">{formatFCFA(r.montant)}</span>
                    <button
                      type="button"
                      aria-label={`Supprimer ${r.libelle}`}
                      title="Supprimer"
                      onClick={() => setRevenuASupprimer(r)}
                      className="text-destructive"
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      {planning.alertes.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle aria-hidden className="h-4 w-4" />
            Enveloppes à risque
          </h2>
          <ul className="space-y-1 text-xs">
            {planning.alertes.map((a) => (
              <li key={a.enveloppe.id}>
                <span className="font-medium">
                  {a.enveloppe.emoji} {a.enveloppe.nom}
                </span>{" "}
                — semaine {a.semaine} ({jourCourt(a.debut)}) : {a.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 9 — réel vs projeté */}
      <section className="space-y-2 rounded-2xl border border-input bg-card p-3">
        <button
          type="button"
          onClick={() => setVoirPassees((v) => !v)}
          aria-expanded={voirPassees}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <History aria-hidden className="h-4 w-4 text-muted-foreground" />
            Réel vs projeté (4 dernières semaines)
          </span>
          <span className="text-xs text-muted-foreground">
            {planning.fiabilite === null ? "—" : `écart moyen ${planning.fiabilite} %`}
          </span>
        </button>
        {voirPassees && (
          <ul className="space-y-1 text-xs">
            {planning.semainesPassees.map((s) => (
              <li key={s.libelle} className="rounded-xl bg-accent/20 px-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {s.libelle} · {jourCourt(s.debut)} → {jourCourt(s.fin)}
                  </span>
                  <span
                    className={
                      (s.ecartDepenses ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"
                    }
                  >
                    {s.ecartDepenses === null
                      ? "—"
                      : `${s.ecartDepenses > 0 ? "+" : ""}${s.ecartDepenses} %`}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  prévu {formatFCFA(s.depensesPrevues)} · réel {formatFCFA(s.depensesReelles)} ·
                  revenus réels {formatFCFA(s.revenusReels)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Semaine par semaine</h2>
        <ul className="space-y-2">
          {planning.semaines.map((s) => {
            const ouvert = !prefs.condense && ouverte === s.index;
            return (
              <li
                key={s.index}
                className={`overflow-hidden rounded-2xl border ${
                  s.risque ? "border-destructive/50" : "border-input"
                } bg-card`}
              >
                <button
                  type="button"
                  onClick={() => setOuverte(ouvert ? null : s.index)}
                  aria-expanded={ouvert}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/30"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {s.libelle}
                      {s.courante && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                          en cours
                        </span>
                      )}
                      {s.risque && (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] text-destructive">
                          à risque
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {jourCourt(s.debut)} → {jourCourt(s.fin)} · {s.echeances.length} échéance
                      {s.echeances.length > 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold">
                      {formatFCFA(s.depensesPrevues)}
                    </span>
                    <span
                      className={`block text-[11px] ${
                        s.soldeProjete < 0 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      solde {formatFCFA(s.soldeProjete)}
                    </span>
                  </span>
                </button>

                {!prefs.condense && (
                  <div className="px-3 pb-2">
                    <div className="flex h-2 gap-1">
                      <span
                        className="rounded-full bg-primary/60"
                        style={{ width: `${(s.revenusAttendus / maxi) * 50}%` }}
                      />
                      <span
                        className="rounded-full bg-destructive/60"
                        style={{ width: `${(s.depensesPrevues / maxi) * 50}%` }}
                      />
                    </div>
                  </div>
                )}

                {ouvert && (
                  <div className="space-y-2 border-t border-input px-3 py-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <Ligne label="Revenus attendus" valeur={formatFCFA(s.revenusAttendus)} />
                      <Ligne label="Revenus réels" valeur={formatFCFA(s.revenusReels)} />
                      <Ligne label="Dépenses prévues" valeur={formatFCFA(s.depensesPrevues)} />
                      <Ligne label="Dépenses réelles" valeur={formatFCFA(s.depensesReelles)} />
                    </div>

                    {/* 7 — suggestions pour les semaines à risque */}
                    {s.suggestions.length > 0 && (
                      <div className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/5 p-2">
                        <p className="flex items-center gap-1 font-medium text-destructive">
                          <Lightbulb aria-hidden className="h-3.5 w-3.5" /> Comment corriger cette
                          semaine
                        </p>
                        <ul className="list-disc space-y-0.5 pl-4">
                          {s.suggestions.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {s.revenusPrevus.length > 0 && (
                      <ul className="space-y-1">
                        {s.revenusPrevus.map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center justify-between gap-2 rounded-xl bg-primary/10 px-2 py-1"
                          >
                            <span className="min-w-0 truncate">
                              {jourCourt(r.date)} · {r.libelle} (revenu prévu)
                            </span>
                            <span className="shrink-0 font-medium">{formatFCFA(r.montant)}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {s.echeances.length === 0 ? (
                      <p className="text-muted-foreground">Aucune dépense planifiée.</p>
                    ) : (
                      <ul className="space-y-1">
                        {s.echeances.map((e, i) => {
                          const env = enveloppes.find((x) => x.id === e.budget.enveloppeId);
                          return (
                            <li
                              key={`${e.budget.id}-${e.date}-${i}`}
                              className="flex items-center justify-between gap-2 rounded-xl bg-accent/20 px-2 py-1"
                            >
                              <span className="min-w-0 truncate">
                                {jourCourt(e.date)} · {e.budget.libelle}
                                {env ? ` · ${env.emoji} ${env.nom}` : ""}
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className="font-medium">{formatFCFA(e.montant)}</span>
                                {/* 4 — marquer payée */}
                                <button
                                  type="button"
                                  aria-label="Marquer comme payée"
                                  title="Marquer comme payée"
                                  onClick={() => setAction({ genre: "payer", echeance: e })}
                                  className="text-primary"
                                >
                                  <CheckCircle2 aria-hidden className="h-4 w-4" />
                                </button>
                                {/* 5 — reporter d'une semaine */}
                                <button
                                  type="button"
                                  aria-label="Reporter d'une semaine"
                                  title="Reporter d'une semaine"
                                  onClick={() => setAction({ genre: "reporter", echeance: e })}
                                  className="text-muted-foreground"
                                >
                                  <SkipForward aria-hidden className="h-4 w-4" />
                                </button>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {/* 8 — saisie rapide pré-remplie */}
                      <button
                        type="button"
                        onClick={() => ouvrirPopupDepense(s)}
                        className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
                      >
                        Saisir une dépense de cette semaine
                      </button>
                      <button
                        type="button"
                        onClick={() => ouvrirPopupRevenu(s.debut)}
                        className="rounded-full bg-accent/40 px-3 py-1 text-xs"
                      >
                        Ajouter un revenu prévu
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Popup revenu exceptionnel */}
      {popupRevenu && (
        <Popup titre="Revenu exceptionnel" onFermer={() => setPopupRevenu(null)}>
          <Champ label="Libellé">
            <input
              value={rLibelle}
              onChange={(e) => setRLibelle(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-2 py-1.5 text-sm"
              placeholder="Prime, vente, aide…"
            />
          </Champ>
          <Champ label="Montant (FCFA)">
            <input
              inputMode="numeric"
              value={grouperMontant(rMontant)}
              onChange={(e) => setRMontant(deGrouperMontant(e.target.value))}
              className="w-full rounded-xl border border-input bg-background px-2 py-1.5 text-sm"
            />
          </Champ>
          <Champ label="Date">
            <input
              type="date"
              value={rDate}
              onChange={(e) => setRDate(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-2 py-1.5 text-sm"
            />
          </Champ>
          <button
            type="button"
            onClick={() => setConfirmRevenu(true)}
            className="w-full rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            Enregistrer
          </button>
        </Popup>
      )}

      {/* Popup saisie rapide de dépense */}
      {popupDepense && (
        <Popup titre={`Dépense — ${popupDepense.libelle}`} onFermer={() => setPopupDepense(null)}>
          <Champ label="Libellé">
            <input
              value={dLibelle}
              onChange={(e) => setDLibelle(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-2 py-1.5 text-sm"
            />
          </Champ>
          <Champ label="Montant (FCFA)">
            <input
              inputMode="numeric"
              value={grouperMontant(dMontant)}
              onChange={(e) => setDMontant(deGrouperMontant(e.target.value))}
              className="w-full rounded-xl border border-input bg-background px-2 py-1.5 text-sm"
            />
          </Champ>
          <Champ label="Date">
            <input
              type="date"
              value={dDate}
              onChange={(e) => setDDate(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-2 py-1.5 text-sm"
            />
          </Champ>
          <Champ label="Enveloppe">
            <select
              value={dEnveloppe}
              onChange={(e) => setDEnveloppe(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-2 py-1.5 text-sm"
            >
              {enveloppes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.emoji} {e.nom}
                </option>
              ))}
            </select>
          </Champ>
          <Champ label="Compte">
            <select
              value={dCompte}
              onChange={(e) => setDCompte(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-2 py-1.5 text-sm"
            >
              {comptes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Champ>
          <button
            type="button"
            onClick={() => setConfirmDepense(true)}
            className="w-full rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            Enregistrer
          </button>
        </Popup>
      )}

      <Confirmation
        ouvert={action !== null}
        titre={action?.genre === "reporter" ? "Reporter l'échéance" : "Marquer comme payée"}
        message={
          action?.genre === "reporter"
            ? "L'échéance sera décalée d'une semaine."
            : "L'échéance sera convertie en dépense réelle sur le compte associé."
        }
        details={
          action
            ? [
                { label: "Dépense planifiée", apres: action.echeance.budget.libelle },
                { label: "Montant", apres: formatFCFA(action.echeance.montant) },
                {
                  label: "Date",
                  avant: jourCourt(action.echeance.date),
                  apres:
                    action.genre === "reporter"
                      ? jourCourt(ajouterJours(action.echeance.date, 7))
                      : jourCourt(action.echeance.date),
                },
              ]
            : undefined
        }
        onConfirmer={validerAction}
        onAnnuler={() => setAction(null)}
      />

      <Confirmation
        ouvert={confirmRevenu}
        titre="Ajouter ce revenu prévu"
        message="Ce revenu exceptionnel sera pris en compte dans la projection."
        details={[
          { label: "Libellé", apres: rLibelle },
          { label: "Montant", apres: formatFCFA(Number(rMontant) || 0) },
          { label: "Date", apres: rDate },
        ]}
        onConfirmer={enregistrerRevenu}
        onAnnuler={() => setConfirmRevenu(false)}
      />

      <Confirmation
        ouvert={confirmDepense}
        titre="Enregistrer cette dépense"
        message="Cette dépense réelle sera ajoutée à vos opérations."
        details={[
          { label: "Libellé", apres: dLibelle },
          { label: "Montant", apres: formatFCFA(Number(dMontant) || 0) },
          { label: "Date", apres: dDate },
          {
            label: "Enveloppe",
            apres: enveloppes.find((e) => e.id === dEnveloppe)?.nom ?? "—",
          },
          { label: "Compte", apres: dCompte },
        ]}
        onConfirmer={enregistrerDepense}
        onAnnuler={() => setConfirmDepense(false)}
      />

      <Confirmation
        ouvert={revenuASupprimer !== null}
        titre="Supprimer ce revenu prévu"
        message="Il ne sera plus compté dans la projection."
        danger
        details={
          revenuASupprimer
            ? [
                { label: "Libellé", apres: revenuASupprimer.libelle },
                { label: "Montant", apres: formatFCFA(revenuASupprimer.montant) },
              ]
            : undefined
        }
        onConfirmer={() => {
          if (revenuASupprimer) {
            majRevenus(revenusPrevus.filter((r) => r.id !== revenuASupprimer.id));
            toast.success("Revenu prévu supprimé.");
          }
          setRevenuASupprimer(null);
        }}
        onAnnuler={() => setRevenuASupprimer(null)}
      />
    </div>
  );
}

function Popup({
  titre,
  onFermer,
  children,
}: {
  titre: string;
  onFermer: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-3 sm:items-center"
      onClick={onFermer}
    >
      <div
        className="w-full max-w-sm space-y-3 rounded-2xl border border-input bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{titre}</h2>
          <button type="button" onClick={onFermer} className="text-xs text-muted-foreground">
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Carte({
  titre,
  valeur,
  icone,
  alerte,
}: {
  titre: string;
  valeur: string;
  icone: React.ReactNode;
  alerte?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        alerte ? "border-destructive/50 bg-destructive/5" : "border-input bg-card"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icone}
        {titre}
      </div>
      <p className={`mt-1 text-sm font-semibold ${alerte ? "text-destructive" : ""}`}>{valeur}</p>
    </div>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-xl bg-accent/20 px-2 py-1">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <span className="font-medium">{valeur}</span>
    </div>
  );
}
