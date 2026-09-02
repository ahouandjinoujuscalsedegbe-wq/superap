/**
 * Accès à la boîte de réception SMS du téléphone.
 *
 * Sur l'application Android installée, un lecteur natif de SMS peut être
 * branché (permission `READ_SMS`). L'application le détecte au démarrage :
 * s'il est présent, la lecture est automatique ; sinon, l'utilisateur colle
 * ou partage ses messages dans la page « Messages » et tout le reste du
 * traitement reste identique. Aucun message ne quitte jamais le téléphone.
 */
import type { MessageSms } from "./sms-transactions";
import { hachage } from "./sms-transactions";

type LecteurNatif = {
  checkPermissions?: () => Promise<{ sms?: string; receive?: string }>;
  requestPermissions?: () => Promise<{ sms?: string; receive?: string }>;
  getSMSList?: (options: {
    filter?: { minDate?: number; maxCount?: number };
  }) => Promise<{ smsList?: unknown[] }>;
  addListener?: (
    evenement: string,
    rappel: () => void,
  ) => Promise<{ remove: () => Promise<void> | void }> | { remove: () => void };
};

function lecteur(): LecteurNatif | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SMSInboxReader?: LecteurNatif;
    Capacitor?: { Plugins?: Record<string, LecteurNatif> };
  };
  return w.SMSInboxReader ?? w.Capacitor?.Plugins?.["SMSInboxReader"] ?? null;
}

/** Indique si le téléphone expose sa boîte SMS à l'application. */
export function smsDisponible(): boolean {
  const l = lecteur();
  return Boolean(l && typeof l.getSMSList === "function");
}

/** Demande la permission de lecture ; renvoie true si elle est accordée. */
export async function autoriserSms(): Promise<boolean> {
  const l = lecteur();
  if (!l) return false;
  try {
    const actuel = await l.checkPermissions?.();
    if (actuel?.sms === "granted") return true;
    const demande = await l.requestPermissions?.();
    return demande?.sms === "granted";
  } catch {
    return false;
  }
}

function versMessage(brut: unknown): MessageSms | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const corps = typeof o["body"] === "string" ? o["body"] : "";
  if (!corps) return null;
  const expediteur =
    (typeof o["address"] === "string" && o["address"]) ||
    (typeof o["sender"] === "string" && o["sender"]) ||
    "Inconnu";
  const date = Number(o["date"] ?? o["dateSent"] ?? Date.now());
  const id = String(o["id"] ?? o["_id"] ?? `sms:${hachage(`${expediteur}${corps}${date}`)}`);
  return {
    id: id.startsWith("sms:") ? id : `sms:${id}`,
    expediteur,
    corps,
    date: Number.isFinite(date) ? date : Date.now(),
  };
}

/**
 * Lit les SMS reçus depuis une date donnée (30 derniers jours par défaut).
 * Renvoie une liste vide si aucun lecteur natif n'est disponible.
 */
export async function lireSmsRecents(depuis?: number, maximum = 200): Promise<MessageSms[]> {
  const l = lecteur();
  if (!l?.getSMSList) return [];
  const minDate = depuis ?? Date.now() - 30 * 86400000;
  try {
    const reponse = await l.getSMSList({ filter: { minDate, maxCount: maximum } });
    const liste = Array.isArray(reponse?.smsList) ? reponse.smsList : [];
    return liste.map(versMessage).filter((m): m is MessageSms => m !== null);
  } catch {
    return [];
  }
}

/**
 * S'abonne à l'arrivée d'un nouveau SMS pour analyser aussitôt le message.
 * Renvoie une fonction de désabonnement (sans effet si le lecteur est absent).
 */
export function surNouveauSms(rappel: () => void): () => void {
  const l = lecteur();
  if (!l?.addListener) return () => {};
  let retrait: (() => void) | null = null;
  try {
    const abonnement = l.addListener("smsRecu", rappel);
    void Promise.resolve(abonnement).then((a) => {
      retrait = () => void a.remove();
    });
  } catch {
    return () => {};
  }
  return () => retrait?.();
}
