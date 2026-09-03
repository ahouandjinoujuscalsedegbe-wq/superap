import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  GraduationCap,
  MessageSquareText,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  messagesInconnus,
  oublierApprentissageSms,
  oublierRegleSms,
  reglesApprises,
  reinitialiserStatsSms,
  statsSms,
  tauxJustesse,
  tauxReconnaissance,
  type MessageInconnu,
  type SouvenirSms,
  type StatsSms,
} from "@/lib/sms-transactions";
import { useSuperApp } from "@/lib/store";

/**
 * Tableau de bord des performances d'apprentissage de la lecture des messages
 * de transaction. Il reprend exactement la lecture proposée pour les tickets :
 * taux de réussite, ce qui a été retenu, et ce qui reste incompris.
 */
export function TableauApprentissageSms({ version = 0 }: { version?: number }) {
  const { enveloppes } = useSuperApp();
  const [ouvert, setOuvert] = useState(false);
  const [stats, setStats] = useState<StatsSms | null>(null);
  const [regles, setRegles] = useState<SouvenirSms[]>([]);
  const [inconnus, setInconnus] = useState<MessageInconnu[]>([]);

  useEffect(() => {
    if (!ouvert) return;
    setStats(statsSms());
    setRegles(reglesApprises());
    setInconnus(messagesInconnus());
  }, [ouvert, version]);

  const reconnaissance = stats ? Math.round(tauxReconnaissance(stats) * 100) : 0;
  const justesse = stats ? Math.round(tauxJustesse(stats) * 100) : 0;
  const decides = stats ? stats.auto + stats.confirmes + stats.corriges : 0;

  const conseil = useMemo(() => {
    if (!stats || stats.lus === 0)
      return "Aucun message analysé pour l'instant : la lecture démarrera dès le premier SMS reçu.";
    if (reconnaissance < 60)
      return "Beaucoup de messages restent incompris : enregistrez-les une fois à la main, leur format sera retenu.";
    if (justesse < 85)
      return "Corrigez le sens, le compte ou l'enveloppe avant d'enregistrer : chaque correction affine la règle.";
    return "La lecture est fiable : les nouveaux messages du même type s'enregistreront seuls.";
  }, [stats, reconnaissance, justesse]);

  const nomEnveloppe = (id?: string) =>
    id ? (enveloppes.find((e) => e.id === id)?.nom ?? "Enveloppe supprimée") : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-card px-3 py-3 text-xs font-semibold"
      >
        <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
        Performances de l'apprentissage
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquareText className="h-4 w-4 text-primary" aria-hidden />
              Apprentissage de la lecture des messages
            </h2>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              aria-label="Fermer le tableau de bord"
              className="rounded-full p-2"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-16">
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Opérations comprises sans correction</p>
              <p className="text-3xl font-bold text-primary">
                {decides > 0 ? `${justesse} %` : "—"}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${decides > 0 ? justesse : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{conseil}</p>
            </section>

            <section className="grid grid-cols-2 gap-2 text-xs">
              <p className="rounded-xl bg-muted/50 px-3 py-3">
                Messages lus
                <span className="block text-lg font-semibold">{stats?.lus ?? 0}</span>
              </p>
              <p className="rounded-xl bg-muted/50 px-3 py-3">
                Messages compris
                <span className="block text-lg font-semibold">{reconnaissance} %</span>
              </p>
              <p className="rounded-xl bg-muted/50 px-3 py-3">
                Enregistrés seuls
                <span className="block text-lg font-semibold">{stats?.auto ?? 0}</span>
              </p>
              <p className="rounded-xl bg-muted/50 px-3 py-3">
                Confirmés
                <span className="block text-lg font-semibold">{stats?.confirmes ?? 0}</span>
              </p>
              <p className="rounded-xl bg-muted/50 px-3 py-3">
                Corrigés
                <span className="block text-lg font-semibold">{stats?.corriges ?? 0}</span>
              </p>
              <p className="rounded-xl bg-muted/50 px-3 py-3">
                Ignorés
                <span className="block text-lg font-semibold">{stats?.ignores ?? 0}</span>
              </p>
            </section>

            {regles.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Ce que l'application a retenu</h3>
                <ul className="space-y-2">
                  {regles.map((regle) => {
                    const expediteur = regle.signature.split("|")[0] ?? "Expéditeur";
                    const enveloppe = nomEnveloppe(regle.enveloppeId);
                    return (
                      <li
                        key={regle.signature}
                        className="rounded-2xl border border-border bg-card p-3 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold uppercase">{expediteur}</p>
                            <p className="text-muted-foreground">
                              {regle.type === "revenu" ? "Revenu" : "Dépense"}
                              {regle.compte ? ` · compte : ${regle.compte}` : ""}
                              {enveloppe ? ` · enveloppe : ${enveloppe}` : ""}
                            </p>
                            <p className="text-muted-foreground">
                              {regle.occurrences} message{regle.occurrences > 1 ? "s" : ""} appris
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Oublier la règle ${expediteur}`}
                            onClick={() => {
                              oublierRegleSms(regle.signature);
                              setRegles(reglesApprises());
                              toast.success("Règle oubliée");
                            }}
                            className="rounded-full p-2 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {inconnus.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-warning">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  Messages jamais reconnus ({inconnus.length})
                </h3>
                <ul className="space-y-2">
                  {inconnus.slice(0, 10).map((m) => (
                    <li
                      key={m.id}
                      className="rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground"
                    >
                      <p className="font-semibold text-foreground">{m.expediteur}</p>
                      <p className="whitespace-pre-wrap">{m.extrait}</p>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Enregistrez une fois l'opération correspondante à la main : ce format sera ensuite
                  reconnu tout seul.
                </p>
              </section>
            )}

            <button
              type="button"
              onClick={() => {
                oublierApprentissageSms();
                reinitialiserStatsSms();
                setStats(statsSms());
                setRegles([]);
                setInconnus([]);
                toast.success("Apprentissage remis à zéro");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 px-3 py-3 text-xs font-semibold text-destructive"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Tout réapprendre depuis le début
            </button>
          </div>
        </div>
      )}
    </>
  );
}
