/**
 * Sortie « physique » des alarmes : son réel, vibration du téléphone et
 * notification système Android. 100 % local, aucun réseau.
 *
 * Points clés :
 * - Un seul AudioContext réutilisé et débloqué au premier contact de l'écran
 *   (les WebView Android refusent tout son avant un geste utilisateur).
 * - Vibration via le moteur natif (@capacitor/haptics) avec repli sur
 *   navigator.vibrate dans le navigateur.
 * - Notification système (@capacitor/local-notifications) pour que l'alarme
 *   sonne même quand l'application n'est pas au premier plan.
 */

type FenetreAudio = typeof globalThis & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

let ctx: AudioContext | null = null;
let debloque = false;
let permissionNotif: "inconnue" | "accordee" | "refusee" = "inconnue";

function estNatif(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : false;
}

function contexte(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx && ctx.state !== "closed") return ctx;
  const g = globalThis as FenetreAudio;
  const Ctx = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctx) return null;
  try {
    ctx = new Ctx();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * À appeler au premier geste de l'utilisateur : réveille le moteur audio et
 * demande l'autorisation d'afficher des notifications.
 */
export async function debloquerAlarme() {
  if (debloque || typeof window === "undefined") return;
  debloque = true;

  const c = contexte();
  if (c) {
    try {
      if (c.state === "suspended") await c.resume();
      // Son muet d'amorçage : certaines WebView n'ouvrent la sortie audio
      // qu'après avoir réellement joué quelque chose.
      const osc = c.createOscillator();
      const gain = c.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.03);
    } catch {
      /* audio indisponible */
    }
  }

  await demanderPermissionNotification();
}

export async function demanderPermissionNotification(): Promise<boolean> {
  if (permissionNotif !== "inconnue") return permissionNotif === "accordee";
  if (!estNatif()) {
    permissionNotif = "refusee";
    return false;
  }
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    let etat = await LocalNotifications.checkPermissions();
    if (etat.display !== "granted") etat = await LocalNotifications.requestPermissions();
    permissionNotif = etat.display === "granted" ? "accordee" : "refusee";
  } catch {
    permissionNotif = "refusee";
  }
  return permissionNotif === "accordee";
}

/** Bip d'alarme synthétisé localement (aucun fichier audio à télécharger). */
export async function jouerSonAlarme(volume = 70, urgent = false) {
  const c = contexte();
  if (!c) return;
  try {
    if (c.state === "suspended") await c.resume();
    const maitre = c.createGain();
    // Volume nettement plus audible qu'un simple bip discret.
    maitre.gain.value = Math.min(1, Math.max(0, volume / 100)) * (urgent ? 0.9 : 0.6);
    maitre.connect(c.destination);

    const bips = urgent ? 5 : 3;
    const duree = urgent ? 0.26 : 0.2;
    const pas = urgent ? 0.32 : 0.3;

    for (let i = 0; i < bips; i += 1) {
      const debut = c.currentTime + i * pas;
      const enveloppe = c.createGain();
      enveloppe.gain.setValueAtTime(0, debut);
      enveloppe.gain.linearRampToValueAtTime(1, debut + 0.015);
      enveloppe.gain.setValueAtTime(1, debut + duree - 0.04);
      enveloppe.gain.linearRampToValueAtTime(0, debut + duree);
      enveloppe.connect(maitre);

      // Deux oscillateurs : le timbre porte mieux sur un haut-parleur de
      // téléphone qu'une sinusoïde seule.
      for (const [type, freq] of [
        ["square", urgent ? 988 : 740],
        ["triangle", urgent ? 1319 : 988],
      ] as const) {
        const osc = c.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(enveloppe);
        osc.start(debut);
        osc.stop(debut + duree);
      }
    }
  } catch {
    /* audio indisponible : l'alarme reste visuelle */
  }
}

/** Fait vibrer réellement le téléphone (moteur natif si disponible). */
export async function vibrerAlarme(urgent = false) {
  const motif = urgent ? [0, 400, 150, 400, 150, 600] : [0, 250, 150, 250];

  if (estNatif()) {
    try {
      const { Haptics } = await import("@capacitor/haptics");
      // Rejoue le motif via le vibreur natif (durées en millisecondes).
      for (let i = 1; i < motif.length; i += 2) {
        const duree = motif[i] ?? 200;
        const pause = motif[i + 1] ?? 0;
        await Haptics.vibrate({ duration: duree });
        if (pause) await new Promise((r) => setTimeout(r, duree + pause));
      }
      return;
    } catch {
      /* repli navigateur */
    }
  }

  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(motif.slice(1));
    }
  } catch {
    /* vibration indisponible */
  }
}

/** Notification système : l'alarme reste visible et sonore hors application. */
export async function notifierAlarme(titre: string, texte: string, urgent = false) {
  if (!estNatif()) return;
  if (!(await demanderPermissionNotification())) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 2_000_000_000),
          title: titre,
          body: texte,
          smallIcon: "ic_stat_icon_config_sample",
          ongoing: false,
          autoCancel: true,
          schedule: { at: new Date(Date.now() + 300) },
          extra: { urgent },
        },
      ],
    });
  } catch {
    /* notifications indisponibles */
  }
}

/**
 * Déclenche l'alarme complète : bip + vibration + notification système.
 */
export async function declencherAlarmeAppareil(options: {
  volume: number;
  urgent: boolean;
  son: boolean;
  vibration: boolean;
  notification: boolean;
  titre: string;
  texte: string;
}) {
  if (options.son) void jouerSonAlarme(options.volume, options.urgent);
  if (options.vibration) void vibrerAlarme(options.urgent);
  if (options.notification) void notifierAlarme(options.titre, options.texte, options.urgent);
}

/**
 * Programme à l'avance de vraies notifications système aux dates des dépenses
 * planifiées : le téléphone sonne le jour dit, même si l'application n'a pas
 * été ouverte. Les rappels déjà programmés par l'application sont remplacés.
 */
export async function programmerNotificationsPlanifiees(
  rappels: { id: number; titre: string; texte: string; quand: Date }[],
) {
  if (!estNatif()) return;
  if (!(await demanderPermissionNotification())) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");

    // Les rappels planifiés utilisent une plage d'identifiants réservée.
    const enAttente = await LocalNotifications.getPending();
    const aAnnuler = enAttente.notifications.filter(
      (n) => n.id >= ID_PLANIFIE_MIN && n.id <= ID_PLANIFIE_MAX,
    );
    if (aAnnuler.length > 0) {
      await LocalNotifications.cancel({ notifications: aAnnuler.map((n) => ({ id: n.id })) });
    }

    const futurs = rappels.filter((r) => r.quand.getTime() > Date.now());
    if (futurs.length === 0) return;

    await LocalNotifications.schedule({
      notifications: futurs.slice(0, 40).map((r) => ({
        id: r.id,
        title: r.titre,
        body: r.texte,
        smallIcon: "ic_stat_icon_config_sample",
        autoCancel: true,
        schedule: { at: r.quand, allowWhileIdle: true },
      })),
    });
  } catch {
    /* notifications indisponibles */
  }
}

/** Plage d'identifiants réservée aux rappels programmés à l'avance. */
export const ID_PLANIFIE_MIN = 1_500_000_000;
export const ID_PLANIFIE_MAX = 1_599_999_999;

/** Identifiant stable et reproductible pour un rappel (hachage simple). */
export function idRappel(cle: string): number {
  let h = 0;
  for (let i = 0; i < cle.length; i += 1) h = (h * 31 + cle.charCodeAt(i)) | 0;
  return ID_PLANIFIE_MIN + (Math.abs(h) % 99_999_999);
}
