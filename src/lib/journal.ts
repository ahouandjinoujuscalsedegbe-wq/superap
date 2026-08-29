/**
 * Journal d'erreurs et de diagnostics de l'application.
 * Enregistre localement les événements techniques (OCR, dictée vocale,
 * prétraitement d'image, erreurs diverses) pour pouvoir les exporter et
 * corriger rapidement en cas de problème.
 */

const CLE_JOURNAL = "superapp:journal:v1";
const MAX_ENTREES = 200;

export type NiveauJournal = "info" | "avertissement" | "erreur";

export type SourceJournal =
  | "ocr"
  | "dictee"
  | "pretraitement"
  | "saisie"
  | "stockage"
  | "application";

export type EntreeJournal = {
  id: string;
  date: string; // ISO complet
  niveau: NiveauJournal;
  source: SourceJournal;
  message: string;
  /** Détails techniques : confiance OCR, code d'erreur, durée, etc. */
  details?: Record<string, string | number | boolean>;
};

type Abonne = (entrees: EntreeJournal[]) => void;
const abonnes = new Set<Abonne>();

export function lireJournal(): EntreeJournal[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE_JOURNAL);
    const liste = brut ? (JSON.parse(brut) as EntreeJournal[]) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

function ecrire(liste: EntreeJournal[]): EntreeJournal[] {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CLE_JOURNAL, JSON.stringify(liste));
    } catch {
      /* quota dépassé : le journal reste optionnel */
    }
  }
  abonnes.forEach((a) => a(liste));
  return liste;
}

/** Enregistre un événement dans le journal et le renvoie complété. */
export function journaliser(
  niveau: NiveauJournal,
  source: SourceJournal,
  message: string,
  details?: Record<string, string | number | boolean>,
): EntreeJournal {
  const entree: EntreeJournal = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now() + Math.random()),
    date: new Date().toISOString(),
    niveau,
    source,
    message,
    ...(details ? { details } : {}),
  };
  ecrire([entree, ...lireJournal()].slice(0, MAX_ENTREES));
  return entree;
}

export const journalInfo = (
  source: SourceJournal,
  message: string,
  details?: Record<string, string | number | boolean>,
) => journaliser("info", source, message, details);

export const journalAvertissement = (
  source: SourceJournal,
  message: string,
  details?: Record<string, string | number | boolean>,
) => journaliser("avertissement", source, message, details);

export const journalErreur = (
  source: SourceJournal,
  message: string,
  details?: Record<string, string | number | boolean>,
) => journaliser("erreur", source, message, details);

export function supprimerEntreeJournal(id: string): EntreeJournal[] {
  return ecrire(lireJournal().filter((e) => e.id !== id));
}

export function viderJournal(): EntreeJournal[] {
  return ecrire([]);
}

/** Abonnement pour rafraîchir une vue quand le journal change. */
export function surJournal(abonne: Abonne): () => void {
  abonnes.add(abonne);
  return () => {
    abonnes.delete(abonne);
  };
}

/* ----------------------------- Statistiques ----------------------------- */

export type StatsJournal = {
  total: number;
  erreurs: number;
  avertissements: number;
  infos: number;
  parSource: Record<string, number>;
  confianceOcrMoyenne: number | null;
  derniereErreur?: EntreeJournal;
};

export function statistiquesJournal(entrees = lireJournal()): StatsJournal {
  const parSource: Record<string, number> = {};
  const confiances: number[] = [];
  for (const e of entrees) {
    parSource[e.source] = (parSource[e.source] ?? 0) + 1;
    const c = e.details?.["confiance"];
    if (typeof c === "number" && Number.isFinite(c)) confiances.push(c);
  }
  return {
    total: entrees.length,
    erreurs: entrees.filter((e) => e.niveau === "erreur").length,
    avertissements: entrees.filter((e) => e.niveau === "avertissement").length,
    infos: entrees.filter((e) => e.niveau === "info").length,
    parSource,
    confianceOcrMoyenne:
      confiances.length > 0
        ? Math.round(confiances.reduce((s, v) => s + v, 0) / confiances.length)
        : null,
    ...(entrees.find((e) => e.niveau === "erreur")
      ? { derniereErreur: entrees.find((e) => e.niveau === "erreur")! }
      : {}),
  };
}

/* -------------------------------- Export -------------------------------- */

function environnement(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return {
    navigateur: window.navigator.userAgent,
    langue: window.navigator.language,
    ecran: `${window.innerWidth}x${window.innerHeight}`,
    genere: new Date().toISOString(),
  };
}

export function journalEnJson(entrees = lireJournal()): string {
  return JSON.stringify({ environnement: environnement(), entrees }, null, 2);
}

function echapper(valeur: string): string {
  return `"${valeur.replace(/"/g, '""')}"`;
}

export function journalEnCsv(entrees = lireJournal()): string {
  const lignes = [["date", "niveau", "source", "message", "details"].join(";")];
  for (const e of entrees) {
    lignes.push(
      [
        echapper(e.date),
        echapper(e.niveau),
        echapper(e.source),
        echapper(e.message),
        echapper(e.details ? JSON.stringify(e.details) : ""),
      ].join(";"),
    );
  }
  return lignes.join("\n");
}

/** Texte lisible destiné au presse-papiers ou à un message de support. */
export function journalEnTexte(entrees = lireJournal()): string {
  const stats = statistiquesJournal(entrees);
  const entete = [
    "Journal de diagnostic SUPER APP",
    `Généré le ${new Date().toLocaleString("fr-FR")}`,
    `Entrées : ${stats.total} (dont ${stats.erreurs} erreurs, ${stats.avertissements} avertissements)`,
    stats.confianceOcrMoyenne !== null
      ? `Confiance OCR moyenne : ${stats.confianceOcrMoyenne} %`
      : "Confiance OCR moyenne : non mesurée",
    "",
  ].join("\n");
  const corps = entrees
    .map(
      (e) =>
        `[${e.date}] ${e.niveau.toUpperCase()} · ${e.source} — ${e.message}${
          e.details ? ` · ${JSON.stringify(e.details)}` : ""
        }`,
    )
    .join("\n");
  return `${entete}${corps}`;
}

/** Déclenche le téléchargement d'un fichier depuis le navigateur. */
export function telechargerFichier(nom: string, contenu: string, type: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([contenu], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exporterJournalJson(entrees = lireJournal()): void {
  telechargerFichier(
    `journal-superapp-${new Date().toISOString().slice(0, 10)}.json`,
    journalEnJson(entrees),
    "application/json",
  );
}

export function exporterJournalCsv(entrees = lireJournal()): void {
  telechargerFichier(
    `journal-superapp-${new Date().toISOString().slice(0, 10)}.csv`,
    journalEnCsv(entrees),
    "text/csv",
  );
}

/** Capture globale des erreurs non gérées (à monter une seule fois). */
export function installerCaptureGlobale(): () => void {
  if (typeof window === "undefined") return () => {};
  const surErreur = (e: ErrorEvent) => {
    journalErreur("application", e.message || "Erreur inattendue", {
      fichier: String(e.filename ?? ""),
      ligne: e.lineno ?? 0,
    });
  };
  const surRejet = (e: PromiseRejectionEvent) => {
    journalErreur("application", `Promesse rejetée : ${String(e.reason ?? "inconnue")}`);
  };
  window.addEventListener("error", surErreur);
  window.addEventListener("unhandledrejection", surRejet);
  return () => {
    window.removeEventListener("error", surErreur);
    window.removeEventListener("unhandledrejection", surRejet);
  };
}
