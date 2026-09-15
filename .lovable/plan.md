# Correction générale de SUPER APP

## Objectif
Corriger les défauts vérifiables qui peuvent fausser les soldes, perdre des données, bloquer une restauration, ralentir l’application ou faire échouer l’APK, tout en conservant le fonctionnement local-first et les sauvegardes distantes uniquement chiffrées.

## Corrections prévues

### 1. Fiabilité des comptes et des soldes
- Propager le renommage d’un compte vers les enveloppes, budgets, remplissages, objectifs et échéanciers de dettes.
- Empêcher la suppression d’un compte encore utilisé par une échéance de dette ou de créance.
- Corriger la modification d’une dette/créance pour mettre à jour ses mouvements miroir et éviter tout écart entre la fiche et les soldes.
- Nettoyer et valider toutes les modifications de dettes comme les autres données métier.
- Distinguer le solde initial d’un vrai revenu afin qu’il ne gonfle pas les rapports mensuels.

### 2. Protection contre les pertes de données
- Fusionner aussi les comptes, enveloppes et catégories créés pendant le chargement initial, sans ressusciter les éléments supprimés.
- Sérialiser la création du secret local entre onglets/contextes compatibles et conserver un repli sûr.
- Faire remonter les échecs d’écriture chiffrée au lieu de les ignorer silencieusement.
- Orienter explicitement un stockage local illisible vers la récupération par e-mail et phrase de récupération.
- Conserver l’effacement après codes erronés, mais empêcher son activation ou son déclenchement sans copie distante vérifiée.
- Bloquer une fusion multi-appareil lorsqu’un conflit n’a pas reçu de choix explicite.

### 3. Sauvegarde et récupération
- Garantir qu’une sauvegarde avant mise à jour utilise le dernier état réellement écrit.
- Ajouter une solution compatible aux copies compressées sur les anciens téléphones.
- Signaler les purges de versions et les échecs de stockage au lieu de présenter une réussite trompeuse.
- Renforcer l’accès public au coffre contre les essais automatisés sans stocker les données métier en clair.

### 4. Interface et fonctionnement mobile
- Corriger les avertissements de fonctions serveur obsolètes.
- Vérifier les routes principales, le retour, le clavier, les barres fixes, la restauration et les écrans de chargement sur formats mobile et bureau.
- Rechercher les erreurs d’hydratation, écrans blancs/noirs, boutons masqués et débordements.
- Optimiser les calculs ou chargements réellement coûteux identifiés pendant les parcours longs.

### 5. Compilation et mise à jour Android
- Fiabiliser la détection du SDK Android préinstallé et vérifier les plateformes/outils nécessaires avant Gradle.
- Valider le fichier Android final après les modifications automatiques.
- Refuser les versions invalides, identiques ou inférieures à la dernière version publiée.
- Réduire l’exposition temporaire de la clé de signature et clarifier sa conservation indispensable.
- Conserver uniquement la production d’un APK Release signé et vérifié par empreinte.

## Validation
- Ajouter des tests de non-régression pour les renommages, dettes, soldes initiaux, chargement concurrent, conflits multi-appareil et stockage défaillant.
- Exécuter les contrôles TypeScript, les tests existants et nouveaux, puis la construction mobile.
- Tester les parcours essentiels dans un navigateur mobile simulé : création de compte, dépense, dette, remboursement, objectif, sauvegarde et récupération.
- Vérifier le workflow Android jusqu’au point reproductible localement et rendre chaque éventuel échec distant explicite.

## Limite vérifiable
La fabrication finale de l’APK signé reste exécutée par GitHub. Le projet sera corrigé et contrôlé localement ; le résultat final de GitHub devra être confirmé par une nouvelle exécution du workflow.
