/**
 * Veille du conseiller : le cerveau qui surveille TOUT, en continu.
 *
 * Ce module ne touche ni à l'écran ni au stockage chiffré : il transforme
 * l'état de l'application (opérations, objectifs, revenus, dépenses, constats
 * du cerveau local) en publications destinées à la discussion
 * « Mon conseiller ». Trois niveaux :
 *   • message — information, orientation, encouragement ;
 *   • alerte  — avertissement notifié sur le téléphone ;
 *   • alarme  — avertissement sonore, situation grave.
 *
 * Tout est calculé sur l'appareil, aucune donnée ne sort.
 */
import type { Constat } from "@/lib/cerveau/regles";
import type { Faits } from "@/lib/cerveau/faits";

export type NiveauVeille = "message" | "alerte" | "alarme";

export type PublicationVeille = {
  /** Identifiant stable : sert à ne pas répéter le même message. */
  id: string;
  titre: string;
  texte: string;
  details: string[];
  niveau: NiveauVeille;
};

export type MemoireVeille = {
  /** Date ISO de la dernière publication, par identifiant. */
  publie: Record<string, string>;
  /** Jour du dernier point quotidien (AAAA-MM-JJ). */
  dernierPoint: string;
  /** Identifiants des opérations déjà commentées. */
  operationsVues: string[];
  /** Objectifs déjà salués à leur création. */
  objectifsVus: string[];
};

export const MEMOIRE_VEILLE_VIDE: MemoireVeille = {
  publie: {},
  dernierPoint: "",
  operationsVues: [],
  objectifsVus: [],
};

export type OperationVeille = {
  id: string;
  type: "revenu" | "depense";
  montant: number;
  libelle?: string;
  date: string;
};

export type ObjectifVeille = {
  id: string;
  libelle: string;
  montantCible: number;
  montantActuel?: number;
  echeance?: string;
};

export type EntreeVeille = {
  faits: Faits;
  constats: Constat[];
  operations: OperationVeille[];
  objectifs: ObjectifVeille[];
  maintenant?: Date;
};

/** Délai minimal avant de redire la même chose, par niveau (en heures). */
const REPOS_HEURES: Record<NiveauVeille, number> = { alarme: 12, alerte: 24, message: 72 };

/** Nombre maximal de publications par passage : le conseiller n'inonde pas. */
const MAX_PAR_PASSAGE = 4;

const f = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

function jourDe(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function niveauDuConstat(constat: Constat): NiveauVeille {
  if (constat.gravite === "alerte") return "alarme";
  if (constat.gravite === "attention") return "alerte";
  return "message";
}

function reposEcoule(memoire: MemoireVeille, id: string, niveau: NiveauVeille, maintenant: Date) {
  const dernier = memoire.publie[id];
  if (!dernier) return true;
  const ecart = maintenant.getTime() - new Date(dernier).getTime();
  return !Number.isFinite(ecart) || ecart >= REPOS_HEURES[niveau] * 3_600_000;
}

/**
 * Construit les publications du conseiller et la mémoire mise à jour.
 * Fonction pure : même entrée, même sortie.
 */
export function construireVeille(
  entree: EntreeVeille,
  memoire: MemoireVeille = MEMOIRE_VEILLE_VIDE,
): { publications: PublicationVeille[]; memoire: MemoireVeille } {
  const maintenant = entree.maintenant ?? new Date();
  const jour = jourDe(maintenant);
  const candidates: PublicationVeille[] = [];
  const suivante: MemoireVeille = {
    publie: { ...memoire.publie },
    dernierPoint: memoire.dernierPoint,
    operationsVues: [...memoire.operationsVues],
    objectifsVus: [...memoire.objectifsVus],
  };

  // 1. Lecture des opérations : tout mouvement enregistré est commenté.
  const vues = new Set(suivante.operationsVues);
  const nouvelles = entree.operations.filter((o) => !vues.has(o.id));
  if (nouvelles.length > 0 && suivante.operationsVues.length > 0) {
    const revenus = nouvelles.filter((o) => o.type === "revenu");
    const depenses = nouvelles.filter((o) => o.type === "depense");
    const totalRev = revenus.reduce((s, o) => s + o.montant, 0);
    const totalDep = depenses.reduce((s, o) => s + o.montant, 0);
    candidates.push({
      id: `operations-${jour}-${nouvelles.length}`,
      titre: `${nouvelles.length} nouvelle(s) opération(s) lue(s)`,
      texte:
        `J'ai enregistré ${revenus.length} entrée(s) pour ${f(totalRev)} et ` +
        `${depenses.length} sortie(s) pour ${f(totalDep)}. Solde disponible suivi : ${f(entree.faits.solde)}.`,
      details: nouvelles
        .slice(-6)
        .map(
          (o) =>
            `${o.type === "revenu" ? "＋" : "−"} ${f(o.montant)} · ${o.libelle || "sans libellé"} (${o.date})`,
        ),
      niveau: totalDep > entree.faits.moyenneDepensesMensuelles * 0.3 ? "alerte" : "message",
    });
  }
  suivante.operationsVues = entree.operations.slice(-400).map((o) => o.id);

  // 2. Objectifs : accusé de réception à la création, rappel en cas de retard.
  const objectifsVus = new Set(suivante.objectifsVus);
  for (const o of entree.objectifs) {
    if (objectifsVus.has(o.id)) continue;
    candidates.push({
      id: `objectif-nouveau-${o.id}`,
      titre: `Objectif suivi : ${o.libelle}`,
      texte:
        `Je suis maintenant votre objectif « ${o.libelle} » (${f(o.montantCible)})` +
        `${o.echeance ? ` pour le ${o.echeance}` : ""}. Je vous préviendrai dès que le rythme d'épargne ne suffit plus.`,
      details: [],
      niveau: "message",
    });
  }
  suivante.objectifsVus = entree.objectifs.map((o) => o.id);

  for (const retard of entree.faits.objectifsEnRetard) {
    candidates.push({
      id: `objectif-retard-${retard.libelle}`,
      titre: `Objectif en retard : ${retard.libelle}`,
      texte: `Il manque ${f(retard.manque)} et il reste ${retard.joursRestants} jour(s). Augmentez le prélèvement mensuel ou repoussez l'échéance.`,
      details: [],
      niveau: "alerte",
    });
  }

  // 3. Constats du cerveau local : chaque gravité a son canal.
  for (const c of entree.constats) {
    if (c.gravite === "bravo") continue;
    candidates.push({
      id: `constat-${c.id}`,
      titre: c.titre,
      texte: c.detail,
      details: [],
      niveau: niveauDuConstat(c),
    });
  }

  // 4. Point du jour : évolution des revenus et des dépenses.
  if (suivante.dernierPoint !== jour) {
    const m = entree.faits.moisCourant;
    const p = entree.faits.moisPrecedent;
    const ecart = p ? m.depenses - p.depenses : 0;
    candidates.push({
      id: `point-${jour}`,
      titre: "Point du jour",
      texte:
        `Ce mois-ci : ${f(m.revenus)} d'entrées, ${f(m.depenses)} de sorties, solde du mois ${f(m.net)}. ` +
        `Projection de fin de mois : ${f(entree.faits.projectionFinDeMois)} sur ${entree.faits.joursRestants} jour(s) restants.`,
      details: [
        p
          ? `Mois précédent : ${f(p.depenses)} de sorties (${ecart >= 0 ? "+" : ""}${f(ecart)}).`
          : "Pas encore de mois précédent pour comparer.",
        entree.faits.tauxEpargne !== null
          ? `Taux d'épargne : ${entree.faits.tauxEpargne} %.`
          : "Taux d'épargne indisponible.",
      ],
      niveau: entree.faits.projectionFinDeMois < 0 ? "alerte" : "message",
    });
    suivante.dernierPoint = jour;
  }

  // Filtrage : rien de redit avant la fin du repos, priorité aux alarmes.
  const ordre: Record<NiveauVeille, number> = { alarme: 0, alerte: 1, message: 2 };
  const publications = candidates
    .filter((p) => reposEcoule(memoire, p.id, p.niveau, maintenant))
    .sort((a, b) => ordre[a.niveau] - ordre[b.niveau])
    .slice(0, MAX_PAR_PASSAGE);

  for (const p of publications) suivante.publie[p.id] = maintenant.toISOString();

  // La mémoire ne grossit pas indéfiniment : on oublie ce qui a plus de 30 jours.
  const limite = maintenant.getTime() - 30 * 86_400_000;
  for (const [id, date] of Object.entries(suivante.publie)) {
    const t = new Date(date).getTime();
    if (!Number.isFinite(t) || t < limite) delete suivante.publie[id];
  }

  return { publications, memoire: suivante };
}
