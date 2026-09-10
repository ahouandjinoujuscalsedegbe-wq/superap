# Garder chaque champ visible au-dessus du clavier

## Résultat attendu
- Sur toutes les pages, le champ en cours de saisie remonte automatiquement au-dessus du clavier.
- Le comportement fonctionne avec le clavier du téléphone et le clavier interne de l’application.
- Les champs placés dans une fenêtre ou une longue page restent lisibles pendant toute la saisie.

## Mise en œuvre
- Ajouter une gestion globale du champ actif, chargée une seule fois pour toute l’application.
- Mesurer en continu la zone réellement visible avec le clavier du téléphone et la hauteur du clavier interne.
- Faire défiler le bon conteneur, y compris dans les fenêtres, jusqu’à laisser une marge lisible au-dessus du clavier.
- Repositionner le champ au focus, à l’ouverture ou au redimensionnement du clavier, et pendant la saisie.
- Conserver le comportement spécial de la discussion avec Mon conseiller sans créer de double déplacement.

## Vérification
- Tester une page longue, une fenêtre contenant un formulaire et Mon conseiller avec un clavier simulé sur écran mobile.
- Vérifier que le champ actif et son texte restent entièrement visibles au-dessus du clavier.
