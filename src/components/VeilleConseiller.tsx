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
      if (publications.length === 0) return;

      const reglages = lireReglagesAlarme();
      for (const p of publications) {
        await publierAlerteConseiller({
          titre: p.titre,
          texte: p.texte,
          ...(p.details.length > 0 ? { details: p.details } : {}),
          urgent: p.niveau === "alarme",
        });
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
          notification: reglages.notification,
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
    // Léger décalage : on laisse l'écran s'afficher avant d'analyser.
    const depart = window.setTimeout(() => void surveiller(), 6000);
    const intervalle = window.setInterval(() => void surveiller(), 15 * 60_000);
    return () => {
      window.clearTimeout(depart);
      window.clearInterval(intervalle);
    };
  }, [surveiller]);

  return null;
}
