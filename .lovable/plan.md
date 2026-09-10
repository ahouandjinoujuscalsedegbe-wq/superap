# Corriger le clavier dans Mon conseiller

## Résultat attendu
- La discussion se réduit exactement à l’espace situé au-dessus du clavier.
- Le champ de saisie reste entièrement visible pendant la frappe.
- Les derniers messages remontent automatiquement, tout en laissant les anciens messages consultables par défilement.

## Mise en œuvre
- Tenir compte à la fois du clavier interne de l’application et du clavier natif du téléphone.
- Redimensionner le conteneur complet de la discussion, plutôt que la page derrière lui.
- Recaler le fil lors de l’ouverture, du changement de taille ou de la fermeture du clavier.
- Vérifier le comportement à une taille d’écran mobile avec le clavier interne ouvert.

## Détails techniques
- Combiner la hauteur de `visualViewport` avec la variable de hauteur du clavier interne.
- Observer les changements réels de taille du conteneur de discussion pour maintenir le dernier message visible.
