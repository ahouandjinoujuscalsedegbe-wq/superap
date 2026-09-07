// Amorçage minimal de l'application Android.
// Ce module ne charge le reste de l'application qu'après les correctifs de
// compatibilité. Des imports statiques ici s'exécuteraient avant les polyfills.
import "./lib/compat-mobile";

function echapperHtml(texte: string): string {
  return texte.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
}

function afficherPanneDemarrage(message: string) {
  const racine = document.getElementById("root");
  if (!racine || racine.childElementCount > 0) return;
  racine.innerHTML = `
    <div style="box-sizing:border-box;min-height:100vh;padding:24px;background:#fdf2f6;color:#3b1d29;font-family:system-ui,sans-serif">
      <h1 style="font-size:19px;margin:0 0 10px">L’application n’a pas pu démarrer</h1>
      <p style="font-size:14px;margin:0 0 12px">Redémarrez l’application. Si le problème persiste, installez la dernière version.</p>
      <pre style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;background:#f6e6ec;padding:10px;border-radius:8px">${echapperHtml(message)}</pre>
      <button type="button" onclick="location.reload()" style="margin-top:14px;padding:10px 16px;border:0;border-radius:8px;background:#c2557a;color:#fff;font-size:14px">Redémarrer</button>
    </div>`;
}

void import("./mobile-app").catch((erreur: unknown) => {
  const message = erreur instanceof Error ? `${erreur.message}\n${erreur.stack ?? ""}` : String(erreur ?? "Erreur inconnue");
  const racine = document.getElementById("root");
  if (racine) racine.setAttribute("data-erreur-demarrage", message);
  afficherPanneDemarrage(message);
});
