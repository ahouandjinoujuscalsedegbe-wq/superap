import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  messagesInconnus,
  reglesApprises,
  reinitialiserStatsSms,
  statsSms,
  tauxJustesse,
  tauxReconnaissance,
  type MessageInconnu,
  type SouvenirSms,
  type StatsSms,
} from "@/lib/sms-transactions";

/**
 * Tableau de bord de fiabilité : montre à l'utilisateur ce que l'application a
 * appris de ses SMS, à quelle vitesse elle progresse, et quels messages elle
 * n'a jamais su comprendre pour qu'il puisse les enseigner.
 */
export function FiabiliteSms({ version }: { version: number }) {
  const [stats, setStats] = useState<StatsSms | null>(null);
  const [inconnus, setInconnus] = useState<MessageInconnu[]>([]);
  const [regles, setRegles] = useState<SouvenirSms[]>([]);

  useEffect(() => {
    setStats(statsSms());
    setInconnus(messagesInconnus());
    setRegles(reglesApprises());
  }, [version]);

  if (!stats) return null;

  const reconnaissance = Math.round(tauxReconnaissance(stats) * 100);
  const justesse = Math.round(tauxJustesse(stats) * 100);
  const decides = stats.auto + stats.confirmes + stats.corriges;

  return (
    <section className="carte space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
        Fiabilité de la lecture
      </h2>

      <div className="grid grid-cols-2 gap-2 text-center">
        <Bloc titre="Messages lus" valeur={String(stats.lus)} />
        <Bloc titre="Compris" valeur={`${reconnaissance} %`} />
        <Bloc titre="Sans correction" valeur={decides > 0 ? `${justesse} %` : "—"} />
        <Bloc titre="Règles apprises" valeur={String(regles.length)} />
      </div>

      <p className="text-xs text-muted-foreground">
        Enregistrées seules : {stats.auto} · confirmées : {stats.confirmes} · corrigées :{" "}
        {stats.corriges} · ignorées : {stats.ignores}. Chaque correction rend la détection suivante
        plus juste.
      </p>

      {inconnus.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-warning">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {inconnus.length} message(s) jamais reconnu(s)
          </p>
          <ul className="space-y-2">
            {inconnus.slice(0, 5).map((m) => (
              <li key={m.id} className="rounded-xl bg-muted/50 p-2 text-xs">
                <span className="font-medium">{m.expediteur}</span>
                <span className="mt-0.5 block text-muted-foreground">{m.extrait}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Enregistrez une fois l'opération correspondante à la main : le moteur reconnaîtra
            ensuite ce type de message tout seul.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          reinitialiserStatsSms();
          setStats(statsSms());
          setInconnus([]);
          toast.success("Statistiques de lecture remises à zéro.");
        }}
        className="inline-flex items-center gap-1 text-xs font-medium text-destructive"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        Remettre les statistiques à zéro
      </button>
    </section>
  );
}

function Bloc({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-lg font-bold">{valeur}</p>
      <p className="text-[11px] text-muted-foreground">{titre}</p>
    </div>
  );
}
