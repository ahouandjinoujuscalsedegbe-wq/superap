/**
 * Contrôle d'authenticité de l'application installée.
 *
 * L'APK officiel est signé avec une clé qui n'appartient qu'à l'éditeur. Une
 * copie modifiée par un attaquant est nécessairement signée avec une autre
 * clé. Au démarrage, l'application compare l'empreinte SHA-256 du certificat
 * de l'APK en cours d'exécution à l'empreinte attendue (intégrée lors de la
 * compilation). Si elle diffère, l'application refuse de s'ouvrir.
 *
 * Sont également détectés les appareils manifestement compromis (root,
 * émulateur) : la synchronisation cloud y est désactivée.
 */

export type VerdictIntegrite = {
  /** Contrôle effectué et concluant. */
  verifiee: boolean;
  /** L'application est une copie non officielle : blocage total. */
  falsifiee: boolean;
  /** Appareil rooté ou émulateur : environnement non fiable. */
  compromis: boolean;
  /** Empreinte lue sur l'appareil (diagnostic). */
  signature: string;
  raison: string;
};

const VERDICT_NEUTRE: VerdictIntegrite = {
  verifiee: false,
  falsifiee: false,
  compromis: false,
  signature: "",
  raison: "Contrôle non applicable (navigateur ou empreinte non configurée).",
};

/** Empreintes autorisées, séparées par des virgules, intégrées à la compilation. */
function empreintesAttendues(): string[] {
  const brut = (import.meta.env["VITE_SIGNATURE_ATTENDUE"] as string | undefined) ?? "";
  return brut
    .split(",")
    .map((e) => e.trim().toLowerCase().replace(/:/g, ""))
    .filter((e) => /^[0-9a-f]{64}$/.test(e));
}

function estNatif(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  try {
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

let cache: VerdictIntegrite | null = null;

/** Vérifie l'authenticité de l'application (une seule fois par session). */
export async function verifierIntegriteApp(): Promise<VerdictIntegrite> {
  if (cache) return cache;
  if (!estNatif()) {
    cache = VERDICT_NEUTRE;
    return cache;
  }
  try {
    const { registerPlugin } = await import("@capacitor/core");
    const plugin = registerPlugin<{
      verifier: () => Promise<{
        signature?: string;
        rooté?: boolean;
        emulateur?: boolean;
      }>;
    }>("IntegriteApp");
    const info = await plugin.verifier();
    const signature = (info.signature ?? "").toLowerCase();
    const compromis = Boolean(info.rooté) || Boolean(info.emulateur);
    const attendues = empreintesAttendues();

    if (attendues.length === 0) {
      cache = { ...VERDICT_NEUTRE, compromis, signature };
      return cache;
    }
    const conforme = attendues.includes(signature);
    cache = {
      verifiee: true,
      falsifiee: !conforme,
      compromis,
      signature,
      raison: conforme
        ? "Application authentique."
        : "La signature de cette application ne correspond pas à la version officielle.",
    };
    return cache;
  } catch {
    cache = { ...VERDICT_NEUTRE, raison: "Contrôle d'authenticité indisponible." };
    return cache;
  }
}

/** Verdict déjà calculé (sans nouvel appel natif). */
export function verdictConnu(): VerdictIntegrite | null {
  return cache;
}

/** Vrai lorsque l'environnement interdit toute synchronisation en ligne. */
export function syncInterdite(): boolean {
  return Boolean(cache && (cache.falsifiee || cache.compromis));
}
