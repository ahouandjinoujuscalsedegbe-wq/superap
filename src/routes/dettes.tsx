import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  HandCoins,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { resteDu, useSuperApp, type Dette } from "@/lib/store";
import { formatDateFr, formatFCFA, grouperMontant, deGrouperMontant } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";

export const Route = createFileRoute("/dettes")({
  head: () => ({
    meta: [
      { title: "Dettes & Créances — Super App" },
      {
        name: "description",
        content:
          "Suivez vos dettes et créances en francs CFA : montants, remboursements partiels, échéances et restes à payer.",
      },
      { property: "og:title", content: "Dettes & Créances — Super App" },
      {
        property: "og:description",
        content: "Gérez ce que vous devez et ce qu'on vous doit, remboursement par remboursement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageDettes,
});

type Formulaire = {
  sens: "dette" | "creance";
  personne: string;
  montant: string;
  dateLimite: string;
  note: string;
};

const FORM_VIDE: Formulaire = {
  sens: "dette",
  personne: "",
  montant: "",
  dateLimite: "",
  note: "",
};

type Dialogue =
  | { type: "creer" }
  | { type: "modifier"; dette: Dette }
  | { type: "rembourser"; dette: Dette }
  | null;

function PageDettes() {
  const {
    dettes,
    ajouterDette,
    modifierDette,
    supprimerDette,
    ajouterRemboursement,
    supprimerRemboursement,
    comptes,
  } = useSuperApp();

  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const [groupeOuvert, setGroupeOuvert] = useState<"dette" | "creance" | null>("dette");
  const [dialogue, setDialogue] = useState<Dialogue>(null);
  const [form, setForm] = useState<Formulaire>(FORM_VIDE);
  const [montantRemb, setMontantRemb] = useState("");
  const [dateRemb, setDateRemb] = useState(new Date().toISOString().slice(0, 10));
  /** Compte impacté par le mouvement d'argent ; vide = aucun mouvement de trésorerie. */
  const [compteMouvement, setCompteMouvement] = useState("");
  const [compteRemb, setCompteRemb] = useState("");
  const [confirmation, setConfirmation] = useState<{
    titre: string;
    message: string;
    details?: { label: string; avant?: string | undefined; apres: string }[] | undefined;
    danger?: boolean | undefined;
    action: () => void;
  } | null>(null);
  const [erreur, setErreur] = useState("");

  const listeDettes = useMemo(() => dettes.filter((d) => d.sens === "dette"), [dettes]);
  const listeCreances = useMemo(() => dettes.filter((d) => d.sens === "creance"), [dettes]);
  const totalDu = listeDettes.reduce((s, d) => s + resteDu(d), 0);
  const totalAttendu = listeCreances.reduce((s, d) => s + resteDu(d), 0);

  const ouvrirCreation = () => {
    setForm(FORM_VIDE);
    setCompteMouvement("");
    setDialogue({ type: "creer" });
  };

  const ouvrirModification = (d: Dette) => {
    setForm({
      sens: d.sens,
      personne: d.personne,
      montant: String(d.montantInitial),
      dateLimite: d.dateLimite ?? "",
      note: d.note ?? "",
    });
    setCompteMouvement("");
    setDialogue({ type: "modifier", dette: d });
  };

  const ouvrirRemboursement = (d: Dette) => {
    setMontantRemb("");
    setDateRemb(new Date().toISOString().slice(0, 10));
    setCompteRemb("");
    setDialogue({ type: "rembourser", dette: d });
  };

  const soumettreFormulaire = () => {
    const montant = Number(form.montant);
    if (!form.personne.trim()) {
      setErreur("Précisez le nom de la personne concernée.");
      return;
    }
    if (!Number.isFinite(montant) || montant <= 0) {
      setErreur("Le montant doit être un nombre positif.");
      return;
    }
    if (
      dialogue?.type === "modifier" &&
      montant < dialogue.dette.montantInitial - resteDu(dialogue.dette)
    ) {
      setErreur("Le montant initial ne peut pas être inférieur au total déjà remboursé.");
      return;
    }
    const label = form.sens === "dette" ? "Dette envers" : "Créance sur";
    setConfirmation({
      titre: dialogue?.type === "modifier" ? "Modifier la fiche" : "Créer la fiche",
      message:
        dialogue?.type === "modifier"
          ? "Confirmez-vous la modification de cette fiche ?"
          : "Confirmez-vous la création de cette fiche ?",
      details: [
        {
          label: "Type",
          avant:
            dialogue?.type === "modifier"
              ? dialogue.dette.sens === "dette"
                ? "Dette"
                : "Créance"
              : undefined,
          apres: form.sens === "dette" ? "Dette" : "Créance",
        },
        {
          label: "Personne",
          avant: dialogue?.type === "modifier" ? dialogue.dette.personne : undefined,
          apres: form.personne.trim(),
        },
        {
          label: "Montant initial",
          avant:
            dialogue?.type === "modifier" ? formatFCFA(dialogue.dette.montantInitial) : undefined,
          apres: formatFCFA(montant),
        },
        {
          label: "Échéance",
          avant:
            dialogue?.type === "modifier"
              ? dialogue.dette.dateLimite
                ? formatDateFr(dialogue.dette.dateLimite)
                : "Aucune"
              : undefined,
          apres: form.dateLimite ? formatDateFr(form.dateLimite) : "Aucune",
        },
        ...(dialogue?.type === "creer"
          ? [
              {
                label: "Mouvement d'argent",
                apres: compteMouvement
                  ? `${form.sens === "dette" ? "Entrée" : "Sortie"} de ${formatFCFA(montant)} sur « ${compteMouvement} »`
                  : "Aucun mouvement de compte",
              },
            ]
          : []),
        { label: "Résumé", apres: `${label} ${form.personne.trim()} : ${formatFCFA(montant)}` },
      ],
      action: () => {
        const base = {
          personne: form.personne.trim(),
          sens: form.sens,
          montantInitial: montant,
          note: form.note.trim() || undefined,
          dateLimite: form.dateLimite || undefined,
        };
        if (dialogue?.type === "modifier") modifierDette(dialogue.dette.id, base);
        else ajouterDette(base, compteMouvement || undefined);
        setDialogue(null);
      },
    });
  };

  const soumettreRemboursement = () => {
    if (dialogue?.type !== "rembourser") return;
    const montant = Number(montantRemb);
    const reste = resteDu(dialogue.dette);
    if (!Number.isFinite(montant) || montant <= 0) {
      setErreur("Le montant du remboursement doit être un nombre positif.");
      return;
    }
    if (montant > reste) {
      setErreur(
        `Le remboursement dépasse le reste dû (${formatFCFA(reste)}). Corrigez le montant.`,
      );
      return;
    }
    if (!dateRemb) {
      setErreur("Précisez la date du remboursement.");
      return;
    }
    setConfirmation({
      titre: "Enregistrer le remboursement",
      message: "Confirmez-vous l'enregistrement de ce remboursement ?",
      details: [
        { label: "Personne", apres: dialogue.dette.personne },
        { label: "Montant", apres: formatFCFA(montant) },
        { label: "Date", apres: formatDateFr(dateRemb) },
        {
          label: "Reste après opération",
          avant: formatFCFA(reste),
          apres: formatFCFA(reste - montant),
        },
        {
          label: "Mouvement d'argent",
          apres: compteRemb
            ? `${dialogue.dette.sens === "dette" ? "Sortie" : "Entrée"} de ${formatFCFA(montant)} sur « ${compteRemb} »`
            : "Aucun mouvement de compte",
        },
      ],
      action: () => {
        ajouterRemboursement(
          dialogue.dette.id,
          { montant, date: dateRemb },
          compteRemb || undefined,
        );
        setDialogue(null);
      },
    });
  };

  const demanderSuppression = (d: Dette) => {
    setConfirmation({
      titre: "Supprimer la fiche",
      message: `La fiche de ${d.personne} et tout son historique de remboursements seront supprimés. Cette action est définitive.`,
      danger: true,
      details: [
        { label: "Type", apres: d.sens === "dette" ? "Dette" : "Créance" },
        { label: "Montant initial", apres: formatFCFA(d.montantInitial) },
        { label: "Reste", apres: formatFCFA(resteDu(d)) },
      ],
      action: () => supprimerDette(d.id),
    });
  };

  const demanderSuppressionRemb = (d: Dette, rembId: string, montant: number, date: string) => {
    setConfirmation({
      titre: "Supprimer le remboursement",
      message: "Confirmez-vous la suppression de ce remboursement ?",
      danger: true,
      details: [
        { label: "Montant", apres: formatFCFA(montant) },
        { label: "Date", apres: formatDateFr(date) },
      ],
      action: () => supprimerRemboursement(d.id, rembId),
    });
  };

  const rendreGroupe = (sens: "dette" | "creance", liste: Dette[], total: number) => {
    const ouvert = groupeOuvert === sens;
    return (
      <section className="carte overflow-hidden">
        <button
          type="button"
          onClick={() => setGroupeOuvert(ouvert ? null : sens)}
          aria-expanded={ouvert}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
        >
          <span className="flex items-center gap-2 font-semibold">
            {sens === "dette" ? (
              <ArrowUpRight className="h-4 w-4 text-destructive" aria-hidden />
            ) : (
              <ArrowDownLeft className="h-4 w-4 text-primary" aria-hidden />
            )}
            {sens === "dette" ? "Mes dettes (je dois)" : "Mes créances (on me doit)"}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {liste.length} fiche{liste.length > 1 ? "s" : ""} · {formatFCFA(total)}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${ouvert ? "rotate-180" : ""}`}
              aria-hidden
            />
          </span>
        </button>

        {ouvert && (
          <ul className="space-y-2 border-t border-border px-3 py-3">
            {liste.length === 0 && (
              <li className="py-2 text-center text-sm text-muted-foreground">
                Aucune fiche pour le moment.
              </li>
            )}
            {liste.map((d) => {
              const reste = resteDu(d);
              const rembourse = d.montantInitial - reste;
              const pct =
                d.montantInitial > 0 ? Math.min(100, (rembourse / d.montantInitial) * 100) : 0;
              const solde = reste === 0;
              const echue =
                !solde &&
                d.dateLimite !== undefined &&
                d.dateLimite < new Date().toISOString().slice(0, 10);
              const expand = ouvertId === d.id;
              return (
                <li key={d.id} className="surface rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setOuvertId(expand ? null : d.id)}
                    aria-expanded={expand}
                    className="w-full px-3 py-2.5 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{d.personne}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          solde
                            ? "bg-primary/10 text-primary"
                            : echue
                              ? "bg-destructive/10 text-destructive"
                              : "bg-accent text-accent-foreground"
                        }`}
                      >
                        {solde ? "Soldée" : echue ? "Échue" : "En cours"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Reste : {formatFCFA(reste)}</span>
                      <span>{Math.round(pct)} % remboursé</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border/60">
                      <div
                        className={`h-full rounded-full transition-all ${solde ? "bg-primary" : "bg-primary/70"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>

                  {expand && (
                    <div className="space-y-3 border-t border-border px-3 py-3 text-sm">
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        <dt className="text-muted-foreground">Montant initial</dt>
                        <dd className="text-right font-medium">{formatFCFA(d.montantInitial)}</dd>
                        <dt className="text-muted-foreground">Déjà remboursé</dt>
                        <dd className="text-right font-medium">{formatFCFA(rembourse)}</dd>
                        <dt className="text-muted-foreground">Reste</dt>
                        <dd className="text-right font-semibold text-primary">
                          {formatFCFA(reste)}
                        </dd>
                        <dt className="text-muted-foreground">Échéance</dt>
                        <dd className={`text-right font-medium ${echue ? "text-destructive" : ""}`}>
                          {d.dateLimite ? formatDateFr(d.dateLimite) : "Aucune"}
                        </dd>
                        <dt className="text-muted-foreground">Créée le</dt>
                        <dd className="text-right font-medium">{formatDateFr(d.creeLe)}</dd>
                      </dl>
                      {d.note && (
                        <p className="rounded-lg bg-background/60 px-2.5 py-2 text-xs text-muted-foreground">
                          {d.note}
                        </p>
                      )}
                      {echue && (
                        <p className="rounded-lg bg-destructive/10 px-2.5 py-2 text-xs font-semibold text-destructive">
                          L'échéance est dépassée et il reste {formatFCFA(reste)} à régler.
                        </p>
                      )}

                      {d.remboursements.length > 0 && (
                        <div>
                          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Remboursements
                          </h3>
                          <ul className="space-y-1">
                            {d.remboursements.map((r) => (
                              <li
                                key={r.id}
                                className="flex items-center justify-between rounded-lg bg-background/60 px-2.5 py-1.5 text-xs"
                              >
                                <span>{formatDateFr(r.date)}</span>
                                <span className="flex items-center gap-2">
                                  <span className="font-semibold">{formatFCFA(r.montant)}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      demanderSuppressionRemb(d, r.id, r.montant, r.date)
                                    }
                                    aria-label={`Supprimer le remboursement du ${formatDateFr(r.date)}`}
                                    title="Supprimer"
                                    className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                  </button>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {!solde && (
                          <button
                            type="button"
                            onClick={() => ouvrirRemboursement(d)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            Ajouter un remboursement
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => ouvrirModification(d)}
                          aria-label={`Modifier la fiche de ${d.personne}`}
                          title="Modifier"
                          className="rounded-lg border border-border p-2 hover:bg-accent/60"
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => demanderSuppression(d)}
                          aria-label={`Supprimer la fiche de ${d.personne}`}
                          title="Supprimer"
                          className="rounded-lg border border-destructive/40 p-2 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2 pr-12">
        <HandCoins className="h-6 w-6 text-primary" aria-hidden />
        <div>
          <h1 className="text-xl font-bold">Dettes & Créances</h1>
          <p className="text-xs text-muted-foreground">
            Je dois : {formatFCFA(totalDu)} · On me doit : {formatFCFA(totalAttendu)}
          </p>
        </div>
      </header>

      <button
        type="button"
        onClick={ouvrirCreation}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Nouvelle dette ou créance
      </button>

      {rendreGroupe("dette", listeDettes, totalDu)}
      {rendreGroupe("creance", listeCreances, totalAttendu)}

      {(dialogue?.type === "creer" || dialogue?.type === "modifier") && !confirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={dialogue.type === "creer" ? "Nouvelle fiche" : "Modifier la fiche"}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-3 pb-6 pt-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialogue(null);
          }}
        >
          <div className="carte max-h-full w-full max-w-md space-y-4 overflow-y-auto p-4">
            <h2 className="text-base font-bold">
              {dialogue.type === "creer" ? "Nouvelle dette ou créance" : "Modifier la fiche"}
            </h2>

            <div className="space-y-1.5">
              <span className="text-sm font-semibold">De quoi s'agit-il ?</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { v: "dette", label: "Je dois (dette)" },
                    { v: "creance", label: "On me doit (créance)" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, sens: o.v }))}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                      form.sens === o.v ? "border-primary text-primary" : "border-border"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="personne" className="text-sm font-semibold">
                Quelle est la personne concernée ?
              </label>
              <input
                id="personne"
                value={form.personne}
                onChange={(e) => setForm((f) => ({ ...f, personne: e.target.value }))}
                placeholder="Ex. : Awa, frère, collègue…"
                className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="montant" className="text-sm font-semibold">
                Quel est le montant concerné ?
              </label>
              <input
                id="montant"
                inputMode="numeric"
                value={grouperMontant(form.montant)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, montant: e.target.value.replace(/[^0-9]/g, "") }))
                }
                placeholder="Montant en FCFA"
                className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="echeance" className="flex items-center gap-1.5 text-sm font-semibold">
                <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
                Quelle est la date limite ? (facultatif)
              </label>
              <input
                id="echeance"
                type="date"
                data-clavier="off"
                value={form.dateLimite}
                onChange={(e) => setForm((f) => ({ ...f, dateLimite: e.target.value }))}
                className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="note-dette" className="text-sm font-semibold">
                Une note ? (facultatif)
              </label>
              <input
                id="note-dette"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Ex. : prêt pour le marché"
                className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              />
            </div>

            {dialogue.type === "creer" && (
              <div className="space-y-1.5">
                <label htmlFor="compte-dette" className="text-sm font-semibold">
                  {form.sens === "dette"
                    ? "Sur quel compte l'argent emprunté est-il entré ?"
                    : "De quel compte l'argent prêté est-il sorti ?"}
                </label>
                <select
                  id="compte-dette"
                  data-clavier="off"
                  value={compteMouvement}
                  onChange={(e) => setCompteMouvement(e.target.value)}
                  className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                >
                  <option value="">Aucun mouvement de compte</option>
                  {comptes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Si un compte est choisi, le solde de ce compte est mis à jour automatiquement.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDialogue(null)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={soumettreFormulaire}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Prévoir
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogue?.type === "rembourser" && !confirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ajouter un remboursement"
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-3 pb-6 pt-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialogue(null);
          }}
        >
          <div className="carte max-h-full w-full max-w-md space-y-4 overflow-y-auto p-4">
            <h2 className="text-base font-bold">Remboursement — {dialogue.dette.personne}</h2>
            <p className="text-xs text-muted-foreground">
              Reste dû : {formatFCFA(resteDu(dialogue.dette))}
            </p>
            <div className="space-y-1.5">
              <label htmlFor="montant-remb" className="text-sm font-semibold">
                Quel montant est remboursé ?
              </label>
              <input
                id="montant-remb"
                inputMode="numeric"
                value={grouperMontant(montantRemb)}
                onChange={(e) => setMontantRemb(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Montant en FCFA"
                className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="date-remb" className="text-sm font-semibold">
                Quelle est la date du remboursement ?
              </label>
              <input
                id="date-remb"
                type="date"
                data-clavier="off"
                value={dateRemb}
                onChange={(e) => setDateRemb(e.target.value)}
                className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="compte-remb" className="text-sm font-semibold">
                {dialogue.dette.sens === "dette"
                  ? "De quel compte sort cet argent ?"
                  : "Sur quel compte cet argent entre-t-il ?"}
              </label>
              <select
                id="compte-remb"
                data-clavier="off"
                value={compteRemb}
                onChange={(e) => setCompteRemb(e.target.value)}
                className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              >
                <option value="">Aucun mouvement de compte</option>
                {comptes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDialogue(null)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={soumettreRemboursement}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Prévoir
              </button>
            </div>
          </div>
        </div>
      )}

      <Confirmation
        ouvert={Boolean(confirmation)}
        titre={confirmation?.titre ?? ""}
        message={confirmation?.message ?? ""}
        details={confirmation?.details}
        danger={confirmation?.danger}
        confirmerLabel={confirmation?.danger ? "Supprimer" : "Confirmer"}
        onConfirmer={() => {
          confirmation?.action();
          setConfirmation(null);
        }}
        onAnnuler={() => setConfirmation(null)}
      />

      <ErreurPopup ouvert={Boolean(erreur)} message={erreur} onFermer={() => setErreur("")} />
    </div>
  );
}
