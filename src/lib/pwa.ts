// Enregistrement contrôlé du service worker.
// Jamais actif en développement ni dans les aperçus Lovable (iframe) :
// le mode hors-ligne ne fonctionne que sur l'application publiée.

const CHEMIN_SW = "/sw.js";

function apercuLovable(hote: string): boolean {
  return (
    hote.startsWith("id-preview--") ||
    hote.startsWith("preview--") ||
    hote === "lovableproject.com" ||
    hote.endsWith(".lovableproject.com") ||
    hote === "lovableproject-dev.com" ||
    hote.endsWith(".lovableproject-dev.com") ||
    hote === "beta.lovable.dev" ||
    hote.endsWith(".beta.lovable.dev")
  );
}

function enregistrementRefuse(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  if (window.self !== window.top) return true;
  if (apercuLovable(window.location.hostname)) return true;
  return new URL(window.location.href).searchParams.get("sw") === "off";
}

async function desenregistrer() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const enregistrements = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    enregistrements
      .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").endsWith(CHEMIN_SW))
      .map((r) => r.unregister()),
  );
}

export async function installerModeHorsLigne(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (enregistrementRefuse()) {
    await desenregistrer();
    return;
  }
  try {
    await navigator.serviceWorker.register(CHEMIN_SW, { scope: "/" });
  } catch {
    /* le mode hors-ligne reste indisponible, l'application fonctionne normalement */
  }
}
