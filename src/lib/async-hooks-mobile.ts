/**
 * Remplacement navigateur de node:async_hooks pour le paquet Android.
 *
 * TanStack Start référence ce module dans son client de fonctions serveur.
 * Dans une WebView, le module Node est remplacé par un objet vide et son
 * initialisation plante avant même que React ou notre écran d'erreur démarre.
 * Le mobile n'exécute aucun contexte serveur : une pile synchrone suffit pour
 * rendre cette dépendance inoffensive côté client.
 */
export class AsyncLocalStorage<T> {
  private valeur: T | undefined;

  run<R>(valeur: T, rappel: () => R): R {
    const precedente = this.valeur;
    this.valeur = valeur;
    try {
      return rappel();
    } finally {
      this.valeur = precedente;
    }
  }

  getStore(): T | undefined {
    return this.valeur;
  }

  enterWith(valeur: T): void {
    this.valeur = valeur;
  }

  disable(): void {
    this.valeur = undefined;
  }
}
