// Amorçage minimal de l'application Android.
// Ce module ne charge le reste de l'application qu'après les correctifs de
// compatibilité. Des imports statiques ici s'exécuteraient avant les polyfills.
import "./lib/compat-mobile";


void import("./mobile-app").catch((erreur: unknown) => {
  const message = erreur instanceof Error ? erreur.message : String(erreur ?? "Erreur inconnue");
  const racine = document.getElementById("root");
  if (racine) racine.setAttribute("data-erreur-demarrage", message);
});
