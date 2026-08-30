"""Test e2e de la purge complète (Playwright).

Lancement : python3 e2e/purge_e2e.py
Prérequis : l'application tourne sur http://localhost:8080
"""

import asyncio
import os
from pathlib import Path

from playwright.async_api import async_playwright

BASE = os.environ.get("APP_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

SEED = """
localStorage.setItem('superapp:test', 'valeur');
sessionStorage.setItem('superapp:session', 'valeur');
document.cookie = 'superapp_cookie=1; path=/';
await new Promise((ok) => {
  const req = indexedDB.open('superapp-test', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('s');
  req.onsuccess = () => { req.result.close(); ok(); };
  req.onerror = () => ok();
});
await caches.open('superapp-cache-test');
return true;
"""

ETAT = """
const bases = indexedDB.databases ? await indexedDB.databases() : [];
return {
  local: localStorage.length,
  session: sessionStorage.length,
  bases: bases.filter((b) => b.name && b.name.includes('superapp-test')).length,
  caches: (await caches.keys()).length,
  cookies: document.cookie.includes('superapp_cookie'),
};
"""


async def main() -> None:
    async with async_playwright() as pw:
        navigateur = await pw.chromium.launch(headless=True)
        contexte = await navigateur.new_context(viewport={"width": 390, "height": 1200})
        page = await contexte.new_page()

        await page.goto(f"{BASE}/parametres", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-test="section-purge"]')

        await page.evaluate(f"async () => {{ {SEED} }}")
        avant = await page.evaluate(f"async () => {{ {ETAT} }}")
        print("avant purge:", avant)
        assert avant["local"] > 0 and avant["session"] > 0
        assert avant["bases"] >= 1 and avant["caches"] >= 1 and avant["cookies"]

        await page.wait_for_timeout(2500)  # hydratation React
        for _ in range(5):
            await page.click('[data-test="ouvrir-purge"]')
            try:
                await page.wait_for_selector('[data-test="option-sauvegarde"]', timeout=2000)
                break
            except Exception:
                await page.wait_for_timeout(1000)
        # On désactive l'export chiffré pour ce scénario.
        case = page.locator('[data-test="option-sauvegarde"]')
        if await case.is_checked():
            await case.uncheck()
        await page.click('[data-test="purge-continuer"]')
        await page.click('[data-test="purge-confirmer"]')

        await page.wait_for_selector('[data-test="purge-succes"]', timeout=15000)
        await page.screenshot(path=str(SCREENSHOTS / "purge_succes.png"))

        apres = await page.evaluate(f"async () => {{ {ETAT} }}")
        print("apres purge:", apres)
        assert apres["local"] <= 1, "localStorage doit être vide (hors journal)"
        assert apres["session"] == 0, "sessionStorage doit être vide"
        assert apres["bases"] == 0, "les bases IndexedDB doivent être supprimées"
        assert apres["caches"] == 0, "les caches doivent être vidés"
        assert not apres["cookies"], "les cookies doivent être supprimés"

        texte = (await page.inner_text('[data-test="purge-succes"]')).upper()
        assert "SUPPRESSION R" in texte
        for libelle in ("LOCALSTORAGE", "INDEXEDDB", "CACHES", "COOKIES", "SERVICE WORKERS"):
            assert libelle in texte, f"récapitulatif incomplet : {libelle}"
        assert await page.locator('[data-test="demarrer-a-zero"]').is_visible()

        # Le journal conserve une trace de la purge après rechargement.
        await page.click('[data-test="demarrer-a-zero"]')
        await page.wait_for_selector('[data-test="journal-donnees"]')
        await page.wait_for_timeout(1500)
        journal = (await page.inner_text('[data-test="journal-donnees"]')).upper()
        assert "PURGE COMPL" in journal, "la purge doit apparaître dans le journal"

        print("OK — purge e2e validée")
        await navigateur.close()


asyncio.run(main())
