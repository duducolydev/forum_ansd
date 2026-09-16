# Tests de charge (brief §8)

Trois scénarios, un par point critique nommé dans le brief : **réservation de
panel**, **synchronisation de scans**, **inscription au comptoir**.

## Cibles du brief

| Grandeur                   | Cible §8                    |
| -------------------------- | --------------------------- |
| Participants               | 1 500                       |
| Points de contrôle         | 6                           |
| Scans en pointe            | 2 / s                       |
| Réservations à l'ouverture | 300 en 10 min, soit 0,5 / s |

Ces débits sont modestes ; l'objet de ces tests n'est pas de chercher un plafond
mais de **vérifier que rien ne se dégrade** au débit visé : pas d'erreur, pas de
dérive des temps de réponse, et surtout **aucune sur-réservation** ni doublon de
présence sous charge.

## État

Ces scripts sont **écrits mais n'ont pas été exécutés** : `k6` n'est pas
installé sur le poste de développement, et le faire tourner contre une base de
démonstration à 19 participants ne prouverait rien. Ils sont destinés au serveur
de recette, une fois l'hébergement obtenu (PLAN.md T1), avec un jeu de données
représentatif.

## Préparer

```bash
# k6 : https://grafana.com/docs/k6/latest/set-up/install-k6/
winget install k6                      # Windows
sudo apt-get install k6                # Debian/Ubuntu

# Jeu de données : 1 500 participants confirmés, un panel à forte capacité,
# un point de contrôle actif.
pnpm db:seed
```

## Exécuter

```bash
BASE_URL=https://recette.forum.ansd.sn k6 run k6/reservation.js
BASE_URL=https://recette.forum.ansd.sn k6 run k6/scan-sync.js
BASE_URL=https://recette.forum.ansd.sn k6 run k6/accueil.js
```

Chaque script échoue si un seuil est franchi : le code de sortie non nul suffit
à faire échouer une étape d'intégration continue.

## Ce que chaque scénario surveille

- **`reservation.js`** — 300 réservations en 10 minutes sur une session à
  capacité limitée. Le contrôle qui compte n'est pas le temps de réponse mais
  l'**absence de sur-réservation** : le nombre d'inscrits confirmés ne doit
  jamais dépasser la capacité, ce que le verrou de ligne garantit (chantier 4.5)
  et qu'un test unitaire vérifie déjà à 20 requêtes simultanées.
- **`scan-sync.js`** — 2 scans par seconde répartis sur 6 points, par lots comme
  le fait le scanner hors ligne. Vérifie qu'aucun lot n'est perdu et que les
  renvois ne créent pas de doublon (`clientScanId`).
- **`accueil.js`** — inscriptions au comptoir enchaînées, pour situer le temps
  serveur dans la cible des 90 secondes par personne (brief §5.7). Le reste du
  délai — saisie, photo, impression — se chronomètre à la répétition générale.
