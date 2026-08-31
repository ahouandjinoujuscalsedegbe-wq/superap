# Corriger la navigation Retour et les zones mobiles

## Objectif
Rendre l’application fiable sur téléphone : le bouton Retour revient à l’écran précédent, aucun contenu ni clavier n’est masqué par les barres système ou la navigation de l’application, et toutes les fenêtres s’affichent centrées et adaptées à l’écran.

## Mise en œuvre
- Brancher le bouton Retour natif Android sur l’historique TanStack : fermer d’abord les éléments superposés ouverts, revenir à la page précédente lorsqu’elle existe, puis laisser Android gérer la sortie depuis l’accueil.
- Centraliser les dimensions et marges de sécurité en bas d’écran afin que toutes les pages réservent exactement la hauteur de la barre de navigation de l’application et de la barre système du téléphone.
- Corriger le clavier interne : le placer au-dessus de la zone système, mesurer sa hauteur réelle et conserver le champ actif ainsi que toutes les touches visibles sans chevauchement avec la navigation de l’application.
- Uniformiser les pop-ups existants avec un conteneur global centré, une largeur adaptée aux petits écrans, une hauteur maximale tenant compte des zones sûres et un défilement interne pour les formulaires longs.
- Vérifier les pages et composants qui utilisent encore des fenêtres alignées en bas et les faire adopter ce comportement commun.

## Détails techniques
- Ajouter l’intégration native Capacitor App pour l’événement `backButton`, avec nettoyage correct du listener React.
- Définir des variables CSS globales pour la hauteur de navigation, les safe areas et la hauteur visuelle disponible (`100dvh`/Visual Viewport).
- Appliquer des classes communes aux overlays et contenus modaux, sans modifier leur logique métier.
- Tester dans une largeur mobile proche de 394 px, avec pages longues, modales et clavier ouverts.
