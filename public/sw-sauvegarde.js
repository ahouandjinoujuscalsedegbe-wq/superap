/*
 * Service worker de sauvegarde.
 *
 * Il garde le dernier colis chiffré dans une petite base locale (IndexedDB) et
 * l'envoie au serveur même lorsque l'application est fermée : dès que le
 * téléphone retrouve Internet, le système réveille ce worker (evenement
 * "sync"), et il réessaie aussi périodiquement ("periodicsync").
 */

const BASE = "superapp-sauvegarde";
const MAGASIN = "colis";
const POINT_ENVOI = "/api/public/sauvegarde/envoi";

function ouvrirBase() {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(BASE, 1);
    requete.onupgradeneeded = () => {
      if (!requete.result.objectStoreNames.contains(MAGASIN)) {
        requete.result.createObjectStore(MAGASIN);
      }
    };
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

async function lireColis() {
  const base = await ouvrirBase();
  return new Promise((resoudre) => {
    const r = base.transaction(MAGASIN, "readonly").objectStore(MAGASIN).get("courant");
    r.onsuccess = () => resoudre(r.result || null);
    r.onerror = () => resoudre(null);
  });
}

async function effacerColis() {
  const base = await ouvrirBase();
  await new Promise((resoudre) => {
    const r = base.transaction(MAGASIN, "readwrite").objectStore(MAGASIN).delete("courant");
    r.onsuccess = () => resoudre();
    r.onerror = () => resoudre();
  });
}

async function envoyerColisEnAttente() {
  const colis = await lireColis();
  if (!colis || !colis.email || !colis.colis) return;
  const reponse = await fetch(POINT_ENVOI, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(colis),
  });
  if (!reponse.ok) throw new Error("envoi impossible");
  const resultat = await reponse.json().catch(() => ({ envoye: false }));
  if (!resultat.envoye) throw new Error(resultat.raison || "envoi refuse");
  await effacerColis();
  const clients = await self.clients.matchAll();
  for (const client of clients) client.postMessage({ type: "sauvegarde-envoyee" });
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("sync", (e) => {
  if (e.tag === "sauvegarde-email") e.waitUntil(envoyerColisEnAttente());
});

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "sauvegarde-email") e.waitUntil(envoyerColisEnAttente());
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "envoyer-maintenant") {
    e.waitUntil(envoyerColisEnAttente().catch(() => undefined));
  }
});
