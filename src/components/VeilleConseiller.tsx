import { useCallback, useEffect, useRef } from "react";
import { useSuperApp } from "@/lib/store";
import { useCerveau } from "@/lib/cerveau/hook";
import { lireReglagesAlarme } from "@/lib/alarme";
import { declencherAlarmeAppareil } from "@/lib/alarme-appareil";
import { publierAlerteConseiller } from "@/lib/alertes-conseiller";
import {
  construireVeille,
  MEMOIRE_VEILLE_VIDE,
  type MemoireVeille,
  type PublicationVeille,
} from "@/lib/veille-conseiller";

const CLE_MEMOIRE = "super-app:veille-conseiller";

function lireMemoireVeille(): MemoireVeille {
  if (typeof window === "undefined") return MEMOIRE_VEILLE_VIDE;
  try {
    const brut = window.localStorage.getItem(CLE_MEMOIRE);
    if (!brut) return MEMOIRE_VEILLE_VIDE;
    const lu = JSON.parse(brut) as Partial<MemoireVeille>;
    return {
      publie: lu.publie && typeof lu.publie === "object" ? lu.publie : {},
      dernierPoint: typeof lu.dernierPoint === "string" ? lu.dernierPoint : "",
      operationsVues: Array.isArray(lu.operationsVues) ? lu.operationsVues : [],
      objectifsVus: Array.isArray(lu.objectifsVus) ? lu.objectifsVus : [],
    };
  } catch {
    return MEMOIRE_VEILLE_VIDE;
  }
}

function ecrireMemoireVeille(memoire: MemoireVeille) {
  try {
    window.localStorage.setItem(CLE_MEMOIRE, JSON.stringify(memoire));
  } catch {
    /* stockage plein : la veille continue sans mémoire */
  }
}

/**
 * Veille permanente du conseiller.
 *
 * Le conseiller devient le centre unique des alertes : il lit toutes les
 * opérations, tous les objectifs et l'évolution des revenus et des dépenses,
 * puis dépose ses conseils, orientations et avertissements dans la discussion
 * « Mon conseiller ». Les avertissements graves déclenchent en plus une
 * notification et une alarme sonore sur le téléphone.
 */
export function VeilleConseiller() {
  const { transactions, objectifs } = useSuperApp();
  const cerveau = useCerveau();
  const enCours = useRef(false);

  const surveiller = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    try {
      const memoire = lireMemoireVeille();
      const { publications, memoire: suivante } = construireVeille(
        {
          faits: cerveau.faits,
          constats: cerveau.constats,
          operations: transactions.map((t) => ({
            id: t.id,
            type: t.type,
            montant: t.montant,
            libelle: t.libelle,
            date: t.date,
          })),
          objectifs: objectifs.map((o) => ({
            id: o.id,
            libelle: o.libelle,
            montantCible: o.cible,
            echeance: o.dateCible,
          })),
        },
        memoire,
      );
      ecrireMemoireVeille(suivante);

      // Rappels programmés : même application fermée, le téléphone affiche
      // le point du conseiller chaque matin pendant une semaine.
      const matin = new Date();
      matin.setHours(8, 0, 0, 0);
      const rappels = Array.from({ length: 7 }, (_, i) => {
        const quand = new Date(matin.getTime() + (i + 1) * 86_400_000);
        return {
          id: idConseiller(`point-${quand.toISOString().slice(0, 10)}`),
          titre: "Mon conseiller · point du jour",
          texte: "Ouvrez la discussion : j'ai analysé vos opérations et j'ai des conseils.",
          quand,
        };
      });
      void programmerRappelsConseiller(rappels);

      if (publications.length === 0) return;

      const reglages = lireReglagesAlarme();
      // Aucune attente : chaque publication part immédiatement en message ET
      // en notification du téléphone, visible même application fermée.
      for (const p of publications) {
        await publierAlerteConseiller({
          titre: p.titre,
          texte: p.texte,
          ...(p.details.length > 0 ? { details: p.details } : {}),
          urgent: p.niveau === "alarme",
        });
        void notifierAlarme(p.titre, p.texte, p.niveau === "alarme");
      }

      // Le plus grave décide de la sonnerie : une seule alarme par passage.
      const grave: PublicationVeille | undefined =
        publications.find((p) => p.niveau === "alarme") ??
        publications.find((p) => p.niveau === "alerte");
      if (grave && reglages.active) {
        await declencherAlarmeAppareil({
          volume: reglages.volume,
          urgent: grave.niveau === "alarme",
          son: reglages.son && grave.niveau === "alarme",
          vibration: reglages.vibration,
          notification: false,
          titre: grave.titre,
          texte: grave.texte,
        });
      }
    } catch {
      /* la veille ne doit jamais casser l'application */
    } finally {
      enCours.current = false;
    }
  }, [cerveau.faits, cerveau.constats, transactions, objectifs]);

  useEffect(() => {
    // Réaction immédiate : dès qu'une donnée bouge, le conseiller analyse et
    // prévient sans attendre. Le court délai évite seulement les rafales.
    const depart = window.setTimeout(() => void surveiller(), 300);
    const intervalle = window.setInterval(() => void surveiller(), 60_000);
    const auRetour = () => {
      if (document.visibilityState === "visible") void surveiller();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearTimeout(depart);
      window.clearInterval(intervalle);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [surveiller]);

  return null;
}
