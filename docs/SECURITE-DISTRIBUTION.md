# Sécurité de distribution de SUPER APP

Objectif : empêcher qu'un attaquant publie une version modifiée de l'application
et la fasse installer à votre place.

## 1. Clé de signature protégée

- La clé (`.jks`) ne doit **jamais** se trouver dans le dépôt. Le workflow
  échoue volontairement s'il en détecte une (`*.jks`, `*.keystore`, `*.p12`
  sont aussi ignorés par Git).
- Elle vit uniquement dans les secrets GitHub :
  `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD`.
- Conservez une copie hors ligne (clé USB chiffrée + gestionnaire de mots de
  passe). Une clé perdue = impossible de publier une mise à jour.

## 2. Contrôle d'authenticité au démarrage

- À la compilation, le workflow calcule l'empreinte SHA-256 du certificat et
  l'injecte dans l'application (`VITE_SIGNATURE_ATTENDUE`).
- Au démarrage, le plugin natif `IntegriteApp` relit l'empreinte réelle de
  l'APK installé. Si elle diffère, l'application affiche un écran de blocage et
  n'ouvre aucune donnée.
- Le même plugin signale un appareil rooté ou un émulateur : la synchronisation
  en ligne est alors désactivée automatiquement.

## 3. Mises à jour sans jeton dans l'application

- Le jeton GitHub n'est plus embarqué dans l'APK. Il est stocké côté serveur
  (secret `SUPERAPP_UPDATE_TOKEN`).
- L'application interroge `/api/public/maj/version` puis télécharge via
  `/api/public/maj/apk?nom=super-app-<version>.apk`.
- Avant installation, l'APK est vérifié : signature d'archive ZIP, taille
  annoncée et empreinte SHA-256 du manifeste.

## 4. Distribution recommandée : Google Play

- Publiez via Google Play avec **Play App Signing** : Google conserve la clé de
  signature finale, ce qui rend une contrefaçon publiable impossible.
- Le canal de test interne permet de diffuser aux proches avant publication.
- Hors Play Store, ne partagez l'APK que depuis les Releases du dépôt, et
  communiquez l'empreinte SHA-256 publiée pour que l'utilisateur puisse la
  comparer.

## 5. Environnement d'exécution

- Root / émulateur détectés : avertissement à l'utilisateur + blocage de la
  synchronisation.
- Pour aller plus loin en production Play Store, activer l'API Play Integrity
  côté Google et refuser la synchronisation si le verdict n'est pas
  `MEETS_DEVICE_INTEGRITY`.

## 6. Coffre scellé par le code PIN

- Paramètres → Sécurité → « Sceller mes données par le code ».
- Une fois activé, la clé de déchiffrement n'est plus stockée en clair : elle
  est scellée en AES-GCM avec une clé dérivée du code PIN (PBKDF2-SHA256,
  150 000 itérations).
- Conséquence : une copie complète du téléphone, une sauvegarde ou un accès
  root ne permettent plus de lire les données sans le code.
- Avertissement : le code oublié = données définitivement illisibles.
