import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquareText, RefreshCw, Check, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import {
  analyserMessages,
  apprendre,
  estTraite,
  fiabilite,
  lireApprentissage,
  lireTraites,
  marquerTraite,
  suggestionApprise,
  SEUIL_CONFIANCE,
  type MessageBrut,
  type TransactionSms,
} from "@/lib/sms-transactions";
import {
  definirLectureAuto,
  demanderPermissionSms,
  lectureAutoActive,
  lectureSmsDisponible,
  lireMessagesRecents,
  permissionSmsAccordee,
} from "@/lib/sms-lecture";

export const Route = createFileRoute("/messages")({
  component: PageMessages,
  head: () => ({
    meta: [
      { title: "Messages de transaction — SUPER APP" },
      {
        name: "description",
        content:
          "Lecture automatique des SMS de transaction Mobile Money et bancaires, pour enregistrer vos revenus et dépenses sans saisie.",
      },
      { property: "og:title", content: "Messages de transaction — SUPER APP" },
      {
        property: "og:description",
        content: "Vos SMS de transaction deviennent automatiquement des opérations enregistrées.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PageMessages() {
  const { enveloppes, comptes, ajouterTransaction } = useSuperApp();
  const [detections, setDetections] = useState<TransactionSms[]>([]);
  const [chargement, setChargement] = useState(false);
  const [autorise, setAutorise] = useState(false);
  const [auto, setAuto] = useState(false);
  const [colle, setColle] = useState("");
  const [score, setScore] = useState(0);

  const natif = lectureSmsDisponible();

  useEffect(() => {
    setAuto(lectureAutoActive());
    setScore(fiabilite(lireApprentissage()));
    void permissionSmsAccordee().then(setAutorise);
  }, []);

  const traiter = useCallback((messages: MessageBrut[]) => {
    const traites = lireTraites();
    const nouvelles = analyserMessages(messages).filter((t) => !estTraite(t.cle, traites));
    setDetections(nouvelles);
    return nouvelles.length;
  }, []);

  async function analyser() {
    if (!natif) {
      toast.info("La lecture des SMS fonctionne uniquement dans l'application Android installée.");
      return;
    }
    setChargement(true);
    try {
      let ok = autorise;
      if (!ok) {
        ok = await demanderPermissionSms();
        setAutorise(ok);
      }
      if (!ok) {
        toast.error("Autorisation refusée : les messages ne peuvent pas être lus.");
        return;
      }
      const messages = await lireMessagesRecents(30, 200);
      const nombre = traiter(messages);
      toast.success(
        nombre > 0
          ? `${nombre} transaction${nombre > 1 ? "s" : ""} détectée${nombre > 1 ? "s" : ""}.`
          : "Aucune nouvelle transaction dans vos messages.",
      );
    } finally {
      setChargement(false);
    }
  }

  function analyserColle() {
    const texte = colle.trim();
    if (!texte) return;
    const nombre = traiter([
      { id: `colle-${Date.now()}`, expediteur: "Message collé", texte, recuLe: Date.now() },
    ]);
    if (nombre === 0) toast.error("Aucun montant reconnu dans ce message.");
    setColle("");
  }

  function basculerAuto(valeur: boolean) {
    setAuto(valeur);
    definirLectureAuto(valeur);
  }

  function enregistrer(
    transaction: TransactionSms,
    choix: { type: "revenu" | "depense"; enveloppe: string; compte: string },
  ) {
    ajouterTransaction({
      type: choix.type,
      montant: transaction.montant,
      libelle: transaction.libelle,
      categorie: choix.enveloppe,
      compte: choix.compte,
      date: transaction.date,
    });
    apprendre(transaction, choix);
    marquerTraite(transaction.cle);
    setDetections((liste) => liste.filter((t) => t.cle !== transaction.cle));
    setScore(fiabilite());
    toast.success(`${formatFCFA(transaction.montant)} enregistré.`);
  }

  function ignorer(transaction: TransactionSms) {
    marquerTraite(transaction.cle);
    setDetections((liste) => liste.filter((t) => t.cle !== transaction.cle));
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <MessageSquareText className="h-5 w-5 text-primary" aria-hidden />
          Messages de transaction
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          L'application lit vos SMS Mobile Money et bancaires sur l'appareil, sans jamais les
          envoyer en ligne, et vous propose l'opération correspondante.
        </p>
      </header>

      <section className="mb-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Lecture automatique</p>
            <p className="text-xs text-muted-foreground">
              Analyse les nouveaux messages à l'ouverture de l'application.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={auto}
            aria-label="Activer la lecture automatique des messages"
            onClick={() => basculerAuto(!auto)}
            className={`h-8 w-14 rounded-full border transition-colors ${
              auto ? "border-primary bg-primary" : "border-input bg-muted"
            }`}
          >
            <span
              className={`block h-6 w-6 rounded-full bg-background transition-transform ${
                auto ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void analyser()}
            disabled={chargement}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${chargement ? "animate-spin" : ""}`} aria-hidden />
            Analyser mes messages
          </button>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Fiabilité apprise : {score}%
          </span>
        </div>

        {!natif ? (
          <p className="mt-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            Sur ordinateur ou navigateur, la lecture directe des SMS n'est pas possible. Collez
            ci-dessous un message pour tester la détection.
          </p>
        ) : null}

        <div className="mt-3">
          <label htmlFor="sms-colle" className="text-xs font-semibold text-muted-foreground">
            Coller un message reçu
          </label>
          <textarea
            id="sms-colle"
            value={colle}
            onChange={(e) => setColle(e.target.value)}
            rows={3}
            placeholder="Vous avez reçu 25 000 FCFA de KOFFI. Frais: 0 FCFA."
            className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={analyserColle}
            className="mt-2 min-h-11 rounded-xl border border-input px-4 text-sm font-semibold text-foreground active:scale-95"
          >
            Analyser ce message
          </button>
        </div>
      </section>

      {detections.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Aucune transaction en attente. Lancez une analyse pour rechercher de nouveaux messages.
        </p>
      ) : (
        <ul className="space-y-3">
          {detections.map((t) => (
            <CarteDetection
              key={t.cle}
              transaction={t}
              enveloppes={enveloppes.map((e) => ({ id: e.id, nom: e.nom }))}
              comptes={comptes}
              onValider={(choix) => enregistrer(t, choix)}
              onIgnorer={() => ignorer(t)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function CarteDetection({
  transaction,
  enveloppes,
  comptes,
  onValider,
  onIgnorer,
}: {
  transaction: TransactionSms;
  enveloppes: { id: string; nom: string }[];
  comptes: string[];
  onValider: (choix: { type: "revenu" | "depense"; enveloppe: string; compte: string }) => void;
  onIgnorer: () => void;
}) {
  const appris = useMemo(() => suggestionApprise(transaction.expediteur), [transaction.expediteur]);
  const [type, setType] = useState<"revenu" | "depense">(transaction.type);
  const [enveloppe, setEnveloppe] = useState(appris.enveloppe ?? "");
  const [compte, setCompte] = useState(appris.compte ?? comptes[0] ?? "");
  const sur = transaction.confiance >= SEUIL_CONFIANCE;

  return (
    <li
      className={`rounded-2xl border-2 bg-card p-4 ${
        sur ? "border-emerald-400/60" : "border-amber-400/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">{transaction.libelle}</p>
          <p className="text-xs text-muted-foreground">
            {transaction.expediteur} · {new Date(transaction.date).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <p
          className={`text-base font-extrabold ${
            type === "revenu" ? "text-emerald-600" : "text-foreground"
          }`}
        >
          {type === "revenu" ? "+" : "−"}
          {formatFCFA(transaction.montant)}
        </p>
      </div>

      {!sur ? (
        <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          Message peu clair : vérifiez le sens et l'enveloppe avant d'enregistrer.
        </p>
      ) : null}

      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{transaction.texte}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-xs font-semibold text-muted-foreground">
          Sens
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "revenu" | "depense")}
            className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="depense">Dépense</option>
            <option value="revenu">Revenu</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Enveloppe
          <select
            value={enveloppe}
            onChange={(e) => setEnveloppe(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="">Sans enveloppe</option>
            {enveloppes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Compte
          <select
            value={compte}
            onChange={(e) => setCompte(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-2 text-sm text-foreground"
          >
            {comptes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onValider({ type, enveloppe, compte })}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-95"
        >
          <Check className="h-4 w-4" aria-hidden />
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onIgnorer}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input px-4 text-sm font-semibold text-foreground active:scale-95"
        >
          <X className="h-4 w-4" aria-hidden />
          Ignorer
        </button>
      </div>
    </li>
  );
}
