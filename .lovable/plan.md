# Organiser les boutons Retour comme un arbre

## Résultat attendu
- Le bouton Retour du haut et le bouton Retour du téléphone suivent exactement la même hiérarchie.
- Chaque page secondaire remonte vers la page principale de sa rubrique, puis vers l’accueil.
- L’historique de navigation ne peut plus envoyer l’utilisateur vers une rubrique sans rapport ou vers une page extérieure.
- Un élément ouvert au-dessus d’une page se ferme avant tout changement de page.

## Arbre principal
```text
Accueil
├── Comptes
│   ├── Comptes existants
│   │   └── Modifier un compte
│   ├── Créer un compte
│   ├── Historique des comptes
│   └── Transferts
│       └── Nouveau transfert
├── Enveloppes
│   ├── Action et gestion
│   ├── Catégories
│   ├── Chronologie
│   ├── Renouvellements
│   └── Détails
├── Budgétisation
│   ├── Plan des dépenses
│   ├── Suivi du mois
│   ├── Bilan
│   └── Réglages du budget
├── Objectifs
│   └── Action
│       ├── Créer
│       └── Gérer
├── Mon conseiller
│   └── Mes données et fiabilité
├── Paramètres
│   └── Pages de réglage
└── Autres entrées principales
    └── Leurs pages de détail
```

## Mise en œuvre
- Remplacer le retour fondé sur l’historique par une table centrale de parents explicites.
- Gérer les pages variables, comme la modification d’un compte ou un rapport mensuel, avec des règles adaptées.
- Faire utiliser cette même fonction à la barre supérieure, aux écrans protégés et au bouton Android.
- Garder le double appui pour quitter uniquement depuis l’accueil.

## Vérification
- Vérifier plusieurs branches profondes ouvertes directement et après une navigation croisée.
- Tester que chaque appui remonte d’un seul niveau jusqu’à l’accueil, sans boucle ni détour.
