/**
 * Pont vers la boîte de réception SMS du téléphone (Android uniquement).
 *
 * Le plugin natif `SMSInboxReader` ne renvoie que les messages reçus, jamais
 * envoyés en ligne. Sur navigateur, la lecture n'est pas disponible : la page
 * propose alors le collage manuel du message.
 */

import type { MessageBrut } from "@/lib/sms-transactions";
import { journalAvertissement, journalInfo } from "@/lib/journal";

type PluginSms = {
  verifierPermission: () => Promise<{ accordee: boolean }>;
  demanderPermission: () => Promise<{ accordee: boolean }>;
  lireMessages: (options: { depuis: number; limite: number }) => Promise<{
    messages: { id: string; expediteur: string; texte: string; recuLe: number }[];
  }>;
};

function plugin(): PluginSms | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } })
    .Capacitor;
  const p = cap?.Plugins?.["SMSInboxReader"];
  return (p as PluginSms | undefined) ?? null;
}

export function lectureSmsDisponible(): boolean {
  return plugin() !== null;
}

export async function permissionSmsAccordee(): Promise<boolean> {
  const p = plugin();
  if (!p) return false;
  try {
    return (await p.verifierPermission()).accordee;
  } catch {
    return false;
  }
}

export async function demanderPermissionSms(): Promise<boolean> {
  const p = plugin();
  if (!p) return false;
  try {
    const { accordee } = await p.demanderPermission();
    journalInfo("sms", accordee ? "Autorisation SMS accordée" : "Autorisation SMS refusée");
    return accordee;
  } catch (erreur) {
    journalAvertissement("sms", "Échec de la demande d'autorisation SMS", {
      detail: String((erreur as Error)?.message ?? erreur),
    });
    return false;
  }
}

/** Lit les SMS reçus depuis `jours` jours (30 par défaut). */
export async function lireMessagesRecents(jours = 30, limite = 200): Promise<MessageBrut[]> {
  const p = plugin();
  if (!p) return [];
  const depuis = Date.now() - jours * 86_400_000;
  try {
    const { messages } = await p.lireMessages({ depuis, limite });
    return (messages ?? []).map((m) => ({
      id: String(m.id),
      expediteur: String(m.expediteur ?? ""),
      texte: String(m.texte ?? ""),
      recuLe: Number(m.recuLe) || Date.now(),
    }));
  } catch (erreur) {
    journalAvertissement("sms", "Lecture des SMS impossible", {
      detail: String((erreur as Error)?.message ?? erreur),
    });
    return [];
  }
}

/* Réglage : lecture automatique activée ou non. */
const CLE_ACTIF = "superapp:sms:actif:v1";

export function lectureAutoActive(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CLE_ACTIF) === "1";
}

export function definirLectureAuto(actif: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_ACTIF, actif ? "1" : "0");
  } catch {
    /* ignoré */
  }
}
