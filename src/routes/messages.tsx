import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Inbox, MessageSquareText, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { BoutonRetour } from "@/components/BoutonRetour";
import { FiabiliteSms } from "@/components/FiabiliteSms";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { lireSmsRecents, smsDisponible, autoriserSms } from "@/lib/sms-lecture";
import {
  analyserMessages,
  apprendreSms,
  definirLectureAuto,
  lectureAutoActive,
  marquerTraite,
  noterStatSms,
  oublierApprentissageSms,
  reglesApprises,
  type OperationSms,
} from "@/lib/sms-transactions";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Lecture des SMS bancaires — SUPER APP" },
      {
        name: "description",
        content:
          "Les SMS de virement et de Mobile Money sont analysés sur le téléphone pour enregistrer automatiquement vos revenus et dépenses.",
      },
      { property: "og:title", content: "Enregistrement automatique depuis vos SMS" },
      {
        property: "og:description",
        content:
          "Détection locale des transactions Mobile Money et bancaires, sans envoi de données.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageMessages,
});

function PageMessages() {
  const { comptes, enveloppes, ajouterTransaction } = useSuperApp();
  const [operations, setOperations] = useState<OperationSms[]>([]);
  const [auto, setAuto] = useState(false);
  const [scan, setScan] = useState(false);
  const [natif, setNatif] = useState(false);
  const [apprises, setApprises] = useState(0);
  const [versionStats, setVersionStats] = useState(0);
  /** Copie des opérations telles que détectées, pour repérer les corrections. */
  const initiales = useRef(new Map<string, OperationSms>());

  useEffect(() => {
    setAuto(lectureAutoActive());
    setNatif(smsDisponible());
    setApprises(reglesApprises().length);
  }, []);

  const contexte = useMemo(
    () => ({
      comptes,
      enveloppes: enveloppes.map((e) => ({ id: e.id, nom: e.nom, categorie: e.categorie })),
    }),
    [comptes, enveloppes],
  );

  const analyser = useCallback(async () => {
    setScan(true);
    try {
      const autorise = await autoriserSms();
      if (!autorise) {
        toast.error("La lecture des SMS n'est pas autorisée sur cet appareil.");
        return;
      }
      const messages = await lireSmsRecents();
      const trouvees = analyserMessages(messages, contexte);
      for (const op of trouvees) initiales.current.set(op.id, { ...op });
      setOperations(trouvees);
      setVersionStats((v) => v + 1);
      toast.success(
        trouvees.length > 0
          ? `${trouvees.length} opération(s) détectée(s) dans vos messages.`
          : "Aucune nouvelle transaction dans vos messages.",
      );
    } finally {
      setScan(false);
    }
  }, [contexte]);

  const majOperation = (id: string, champs: Partial<OperationSms>) =>
    setOperations((v) => v.map((o) => (o.id === id ? { ...o, ...champs } : o)));

  /** L'enveloppe peut être retirée : la clé est alors supprimée de l'objet. */
  const majEnveloppe = (id: string, valeur: string) =>
    setOperations((v) =>
      v.map((o) => {
        if (o.id !== id) return o;
        const suivant = { ...o };
        if (valeur) suivant.enveloppeId = valeur;
        else delete suivant.enveloppeId;
        return suivant;
      }),
    );

  const enregistrer = (op: OperationSms) => {
    ajouterTransaction({
      type: op.type,
      montant: op.montant,
      libelle: op.libelle,
      categorie: op.enveloppeId ?? "",
      compte: op.compte,
      date: op.date,
    });
    if (op.frais > 0) {
      ajouterTransaction({
        type: "depense",
        montant: op.frais,
        libelle: `Frais — ${op.libelle}`,
        categorie: op.enveloppeId ?? "",
        compte: op.compte,
        date: op.date,
      });
    }
    // La décision validée devient une règle : le moteur s'améliore à chaque fois.
    apprendreSms(op, { type: op.type, enveloppeId: op.enveloppeId, compte: op.compte });
    const origine = initiales.current.get(op.id);
    const corrigee =
      !!origine &&
      (origine.type !== op.type ||
        origine.compte !== op.compte ||
        (origine.enveloppeId ?? "") !== (op.enveloppeId ?? ""));
    noterStatSms(corrigee ? { corriges: 1 } : { confirmes: 1 });
    marquerTraite(op.id);
    setApprises(reglesApprises().length);
    setVersionStats((v) => v + 1);
    setOperations((v) => v.filter((o) => o.id !== op.id));
    toast.success("Opération enregistrée depuis le message.");
  };

  const ignorer = (op: OperationSms) => {
    noterStatSms({ ignores: 1 });
    marquerTraite(op.id);
    setVersionStats((v) => v + 1);
    setOperations((v) => v.filter((o) => o.id !== op.id));
  };

  return (
    <div className="space-y-4 pt-4">
      <BoutonRetour to="/" label="Accueil" />

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageSquareText className="h-6 w-6 text-primary" aria-hidden />
          Messages de transaction
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vos SMS Mobile Money et bancaires sont lus et compris sur le téléphone même : montant,
          sens de l'opération, frais et bénéficiaire. Rien n'est envoyé sur Internet.
        </p>
      </header>

      <section className="carte space-y-3 p-4">
        <label className="flex items-start gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => {
              setAuto(e.target.checked);
              definirLectureAuto(e.target.checked);
            }}
            className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span>
            Enregistrement automatique
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Les opérations reconnues avec certitude sont enregistrées seules ; les autres
              attendent votre confirmation ici.
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={analyser}
          disabled={scan}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${scan ? "animate-spin" : ""}`} aria-hidden />
          {scan ? "Lecture en cours…" : "Analyser mes messages"}
        </button>

        {!natif && (
          <p className="rounded-xl bg-warning/10 p-3 text-xs text-warning">
            La lecture des SMS fonctionne dans l'application installée sur le téléphone (APK), après
            avoir accepté l'autorisation « Lire les SMS ». Dans le navigateur, Android n'autorise
            aucun accès à la boîte de réception.
          </p>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
          {apprises} règle(s) apprise(s) de vos validations.
          {apprises > 0 && (
            <button
              type="button"
              onClick={() => {
                oublierApprentissageSms();
                setApprises(0);
                toast.success("Apprentissage réinitialisé.");
              }}
              className="inline-flex items-center gap-1 text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Réinitialiser
            </button>
          )}
        </p>
      </section>

      <FiabiliteSms version={versionStats} />

      <section className="space-y-3">
        {operations.length === 0 && (
          <div className="carte flex flex-col items-center gap-2 p-8 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Aucune opération en attente. Lancez une analyse après un virement reçu ou un paiement.
            </p>
          </div>
        )}

        {operations.map((op) => (
          <article key={op.id} className="carte space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{op.libelle}</h2>
                <p className="text-xs text-muted-foreground">
                  {op.date} · {op.expediteur} · confiance {Math.round(op.confiance * 100)} %
                </p>
              </div>
              <p
                className={`shrink-0 font-bold ${op.type === "revenu" ? "text-success" : "text-destructive"}`}
              >
                {op.type === "revenu" ? "+" : "−"}
                {formatFCFA(op.montant)}
              </p>
            </div>

            <p className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">{op.source}</p>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-muted-foreground">
                Sens
                <select
                  value={op.type}
                  onChange={(e) =>
                    majOperation(op.id, { type: e.target.value as OperationSms["type"] })
                  }
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
                >
                  <option value="revenu">Revenu</option>
                  <option value="depense">Dépense</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Compte
                <select
                  value={op.compte}
                  onChange={(e) => majOperation(op.id, { compte: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
                >
                  {[op.compte, ...comptes.filter((c) => c !== op.compte)].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {op.type === "depense" && (
              <label className="block text-xs font-medium text-muted-foreground">
                Enveloppe
                <select
                  value={op.enveloppeId ?? ""}
                  onChange={(e) => majEnveloppe(op.id, e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Sans enveloppe</option>
                  {enveloppes.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.emoji} {e.nom}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {op.frais > 0 && (
              <p className="text-xs text-muted-foreground">
                Frais détectés : {formatFCFA(op.frais)} (enregistrés comme dépense séparée).
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => ignorer(op)}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-input py-2 text-sm font-medium"
              >
                <X className="h-4 w-4" aria-hidden />
                Ignorer
              </button>
              <button
                type="button"
                onClick={() => enregistrer(op)}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground"
              >
                <Check className="h-4 w-4" aria-hidden />
                Enregistrer
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
