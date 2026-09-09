import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, HandCoins, X } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { idConseiller, notifierAlarme, programmerRappelsConseiller } from "@/lib/alarme-appareil";
import {
  echeancesEnAttente,
  enregistrerReponse,
  rappelsAProgrammer,
  type EcheanceRappel,
} from "@/lib/rappels-objectifs";

/** Vérification des échéances toutes les 2 minutes. */
const PAS_MS = 120_000;

/**
 * Rappelle les cotisations d'une tontine ou d'une épargne programmée au rythme
 * choisi par l'utilisateur. Une notification part sur le téléphone et une carte
 * s'affiche dans l'application : d'un seul geste, l'utilisateur confirme le
 * versement (le mouvement d'argent est alors enregistré si des comptes sont
 * renseignés) ou le refuse.
 */
export function RappelsObjectifs() {
  const { objectifs, ajouterTransfert, chargement } = useSuperApp();
  const [tic, setTic] = useState(0);
  const notifiees = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = window.setInterval(() => setTic((n) => n + 1), PAS_MS);
    return () => window.clearInterval(t);
  }, []);

  const attente = useMemo<EcheanceRappel[]>(() => {
    if (chargement) return [];
    void tic;
    return echeancesEnAttente(objectifs);
  }, [objectifs, chargement, tic]);

  const courante = attente[0] ?? null;

  // Notification système pour l'échéance en cours, une seule fois.
  useEffect(() => {
    if (!courante || notifiees.current.has(courante.cle)) return;
    notifiees.current.add(courante.cle);
    void notifierAlarme(
      courante.type === "tontine"
        ? `Tontine : ${courante.libelle}`
        : `Épargne : ${courante.libelle}`,
      `Cotisation de ${formatFCFA(courante.montant)} prévue le ${courante.date}. Avez-vous effectué le versement ?`,
    );
  }, [courante]);

  // Rappels programmés à l'avance : le téléphone sonne le jour dit.
  useEffect(() => {
    if (chargement) return;
    const rappels = rappelsAProgrammer(objectifs).map((r) => ({
      id: idConseiller(r.cle),
      titre: r.titre,
      texte: r.texte,
      quand: r.quand,
    }));
    void programmerRappelsConseiller(rappels);
  }, [objectifs, chargement]);

  const repondre = useCallback(
    (echeance: EcheanceRappel, fait: boolean) => {
      enregistrerReponse(echeance.cle, fait ? "confirme" : "refuse");
      if (fait) {
        const objectif = objectifs.find((o) => o.id === echeance.objectifId);
        if (objectif?.compteSource && objectif.compteEpargne) {
          ajouterTransfert({
            source: objectif.compteSource,
            destination: objectif.compteEpargne,
            montant: echeance.montant,
            note: `Objectif:${objectif.id} cotisation ${echeance.date}`,
            date: echeance.date,
          });
          toast.success("Versement confirmé et enregistré entre vos comptes.");
        } else {
          toast.success("Versement confirmé.");
        }
      } else {
        toast("Versement noté comme non effectué.");
      }
      setTic((n) => n + 1);
    },
    [objectifs, ajouterTransfert],
  );

  if (!courante) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-50">
      <div className="carte space-y-3 border-primary/40 p-4 shadow-lg">
        <div className="flex items-start gap-2">
          <HandCoins className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-semibold">
              {courante.type === "tontine" ? "Tontine" : "Épargne"} : {courante.libelle}
            </p>
            <p className="text-xs text-muted-foreground">
              Cotisation n° {courante.numero}
              {courante.total ? `/${courante.total}` : ""} du {courante.date} —{" "}
              {formatFCFA(courante.montant)}. Avez-vous effectué le versement ?
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
            {attente.length - 1} autre(s) rappel(s) en attente.
          </p>
        )}
      </div>
    </div>
  );
}
