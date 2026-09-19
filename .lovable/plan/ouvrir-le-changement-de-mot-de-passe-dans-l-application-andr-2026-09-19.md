# Ouvrir le changement de mot de passe dans l’application Android

## Résultat attendu

Après avoir touché « Changer mon mot de passe » dans l’e-mail, Android ouvre directement SUPER APP sur l’écran de création du nouveau mot de passe. Aucun écran du navigateur n’est utilisé.

## Modifications

- Remplacer le lien web de l’e-mail par un lien privé de l’application contenant uniquement l’adresse du compte et le jeton temporaire.
- Déclarer ce lien dans l’APK Android afin que le téléphone l’associe à SUPER APP.
- Traiter le lien au démarrage de l’application, y compris lorsque l’application était complètement fermée.
- Traiter également le lien lorsque l’application est déjà ouverte, puis afficher immédiatement la page « Nouveau mot de passe ».
- Conserver la vérification serveur actuelle, l’expiration de 15 minutes et l’obligation d’utiliser le téléphone qui contient les données.
- Mettre à jour le texte de confirmation pour indiquer que le lien ouvrira directement l’application.
- Augmenter le numéro de version Android, puis valider les contrôles automatiques et la construction mobile.

## Détails techniques

- Schéma privé : `superappbudget://compte?...`.
- Capacitor récupérera le lien initial et écoutera les nouveaux liens reçus.
- Le routeur mobile en mémoire démarrera ou naviguera vers `/compte` avec les paramètres signés.
- Le manifeste Android recevra un filtre d’ouverture limité au schéma et à l’hôte du compte.
