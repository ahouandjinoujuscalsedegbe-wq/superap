import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, HandCoins, X } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { idConseiller, notifierAlarme, programmerRappelsConseiller } from "@/lib/alarme-appareil";
import {
  avancerEcheance,
  echeancesDettesDues,
  rappelsDettesAProgrammer,
  type EcheanceDette,
} from "@/lib/echeancier-dettes";

/** Vérification des échéances toutes les 2 minutes. */
const PAS_MS = 120_000;

/**
 * Rappelle les paiements échelonnés des dettes et les versements attendus sur
 * les créances. Une notification part sur le téléphone et une carte s'affiche
 * dans l'application : d'un geste, l'utilisateur confirme le versement (il est
 * alors enregistré comme un transfert vers le compte dédié) ou le reporte.
 */
export function RappelsDettes() {
  const { dettes, ajouterRemboursement, modifierDette, chargement } = useSuperApp();
  const [tic, setTic] = useState(0);
  const notifiees = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = window.setInterval(() => setTic((n) => n + 1), PAS_MS);
    return () => window.clearInterval(t);
  }, []);

  const attente = useMemo<EcheanceDette[]>(() => {
    if (chargement) return [];
    void tic;
    return echeancesDettesDues(dettes);
  }, [dettes, chargement, tic]);

  const courante = attente[0] ?? null;

  useEffect(() => {
    if (!courante || notifiees.current.has(courante.cle)) return;
    notifiees.current.add(courante.cle);
    void notifierAlarme(
      courante.dette.sens === "dette"
        ? `Paiement à faire : ${courante.dette.personne}`
        : `Versement attendu de ${courante.dette.personne}`,
      `Échéance du ${courante.date} — ${formatFCFA(courante.montant)}. Avez-vous effectué ce versement ?`,
    );
  }, [courante]);

  useEffect(() => {
    if (chargement) return;
    const rappels = rappelsDettesAProgrammer(dettes).map((r) => ({
      id: idConseiller(r.cle),
      titre: r.titre,
      texte: r.texte,
      quand: r.quand,
    }));
    void programmerRappelsConseiller(rappels);
  }, [dettes, chargement]);

  const repondre = useCallback(
    (echeance: EcheanceDette, fait: boolean) => {
      const d = echeance.dette;
      const e = d.echeancier;
      if (fait) {
        ajouterRemboursement(
          d.id,
          { montant: echeance.montant, date: echeance.date, note: "Échéance confirmée" },
          e?.compte,
          { systeme: true },
        );
        toast.success("Versement enregistré entre vos comptes.");
      } else {
        toast("Échéance reportée au rythme suivant.");
      }
      if (e) {
        modifierDette(
          d.id,
          {
            echeancier: {
              ...e,
              prochaine: avancerEcheance(e.prochaine, e.intervalle, e.unite),
            },
          },
          { systeme: true },
        );
      }
      setTic((n) => n + 1);
    },
    [ajouterRemboursement, modifierDette],
  );

  if (!courante) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-50">
      <div className="carte space-y-3 border-primary/40 p-4 shadow-lg">
        <div className="flex items-start gap-2">
          <HandCoins className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-semibold">
              {courante.dette.sens === "dette"
                ? `Paiement à faire : ${courante.dette.personne}`
                : `Versement attendu de ${courante.dette.personne}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Échéance du {courante.date} — {formatFCFA(courante.montant)}. Avez-vous effectué ce
              versement ?
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => repondre(courante, true)}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Check className="h-4 w-4" aria-hidden /> Oui, versé
          </button>
          <button
            type="button"
            onClick={() => repondre(courante, false)}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-input px-3 py-2 text-sm font-semibold text-muted-foreground"
          >
            <X className="h-4 w-4" aria-hidden /> Non, pas encore
          </button>
        </div>
        {attente.length > 1 && (
          <p className="text-center text-xs text-muted-foreground">
            {attente.length - 1} autre(s) échéance(s) en attente.
          </p>
        )}
      </div>
    </div>
  );
}
