# Déployer le portail sur un serveur Linux

Procédure suivie pour le serveur interne de l'ANSD (`10.7.200.41`), puis pour
l'ouverture au public sur `forum2026.ansd.sn`. Chaque commande se lance **sur le
serveur**, dans une session SSH, sauf mention contraire.

Ce que la pile installe : l'application (image construite depuis ce dépôt),
MySQL 8, Redis 7 et nginx, chacun dans son conteneur, redémarrés automatiquement
avec la machine.

---

**Mettre à jour le portail** — une seule commande, qui ne touche pas aux
données (§4) :

```bash
cd /opt/forum-ansd && ./scripts/deployer.sh
```

Sauvegarde, code, images, relecture des migrations, redémarrage, migrations,
puis contrôle qu'aucune table n'a perdu de lignes. **Jamais de `db:seed` sur le
serveur en service**, ni de `forum down -v` : voir §4.1, « Ce qui protège les
données de production ».

---

## 0. Ce qu'il faut savoir avant de commencer

**Le scanner de badges ne fonctionnera pas en HTTP.** Les navigateurs réservent
l'accès à la caméra aux origines sécurisées : sur `http://10.7.200.41`, la
recherche d'un participant par son nom marche, la lecture des QR non. C'est
acceptable pour une recette du site et du BackOffice ; ce ne l'est plus pour une
répétition d'accueil. La bascule en HTTPS (§5) lève ce point.

**Les mots de passe circulent en clair** tant qu'il n'y a pas de TLS, y compris
ceux du BackOffice. Sur le réseau interne de l'ANSD, le temps de la recette, le
risque est assumé ; il ne l'est plus dès que le portail est joignable au-delà.

---

## 1. Préparer le serveur

### 1.1 Vérifier Docker

```bash
docker --version && docker compose version
```

Si l'une des deux commandes échoue, installer les paquets de la distribution —
**les trois à la fois** :

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 docker-buildx
```

`docker.io` seul ne suffit pas, et c'est le piège : le moteur s'installe,
`docker --version` répond, puis `docker compose` échoue sur un
« unknown command ». Compose v2 et buildx sont deux paquets séparés, que l'`apt`
d'Ubuntu se contente de mentionner parmi ses suggestions. Buildx n'est pas
facultatif non plus : `docker compose build` passe par BuildKit, et le service
`outils` vise un étage précis du Dockerfile.

> Le dépôt officiel de Docker (`download.docker.com`) reste une option sur les
> versions d'Ubuntu qu'il publie. Il n'en avait aucune pour Ubuntu 25.10
> (« resolute ») lors de cette installation : les paquets de la distribution
> sont alors la voie la plus courte.

Vérifier les trois :

```bash
docker --version && docker compose version && docker buildx version
```

Puis autoriser l'utilisateur courant à piloter Docker sans `sudo` — **se
déconnecter et se reconnecter** ensuite, le groupe n'est pris en compte qu'à
l'ouverture de session :

```bash
sudo usermod -aG docker "$USER"
```

Une fois reconnecté, un seul essai vérifie à la fois l'accès au démon et la
sortie vers Internet, dont dépend toute la construction :

```bash
docker run --rm hello-world
```

### 1.2 Vérifier la place et la mémoire

```bash
df -h /var/lib/docker /opt
free -h
```

Compter **12 Go** de disque pour les images, la base et le stockage des fichiers
(badges, contributions, photos), et 4 Go de mémoire libre pendant la
construction de l'image.

### 1.3 Ouvrir le port 80

```bash
sudo ufw allow 80/tcp   # si ufw est actif ; sinon, voir avec la DSI
```

---

## 2. Installer le portail

### 2.1 Récupérer le code

```bash
sudo mkdir -p /opt/forum-ansd
sudo chown "$USER":"$USER" /opt/forum-ansd
git clone https://srv-git.ansd.sn/duducoly/forum_ansd.git /opt/forum-ansd
cd /opt/forum-ansd
```

Le chemin `/opt/forum-ansd` n'est pas arbitraire : c'est celui qu'attend la
tâche de sauvegarde (`scripts/backup.cron`).

Le dernier argument de `git clone` compte : sans lui, git crée un sous-dossier
`forum_ansd`, et toutes les commandes suivantes cherchent les fichiers un cran
trop haut. Si c'est arrivé, remonter le contenu plutôt que tout recommencer :

```bash
cd /opt/forum-ansd
shopt -s dotglob && mv forum_ansd/* . && rmdir forum_ansd && shopt -u dotglob
```

### 2.2 Écrire le fichier `.env`

Les secrets sont **générés sur le serveur** : ceux de `.env.example` sont des
exemples publiés, et ceux du poste de développement n'ont rien à faire ici.

Les deux mots de passe MySQL sont tirés **avant** le fichier, parce que le même
mot de passe doit figurer dans `MYSQL_PASSWORD` et dans `DATABASE_URL`. D'où le
garde-fou de la troisième ligne : sans lui, un bloc collé à moitié écrit un
`.env` aux mots de passe vides, et la panne ne se manifeste que deux étapes plus
loin, sur un conteneur MySQL « unhealthy » qui refuse de s'initialiser.

Coller **tout le bloc d'un seul tenant** :

```bash
cd /opt/forum-ansd
MYSQL_PASSWORD="$(openssl rand -hex 16)"
MYSQL_ROOT_PASSWORD="$(openssl rand -hex 16)"
: "${MYSQL_PASSWORD:?génération échouée}" "${MYSQL_ROOT_PASSWORD:?génération échouée}"

cat > .env <<EOF
# --- Adresse du portail ---------------------------------------------------
# Recette interne. À remplacer par https://forum2026.ansd.sn à l'ouverture (§5).
PUBLIC_BASE_URL="http://10.7.200.41"
AUTH_URL="http://10.7.200.41"

# --- Secrets (générés ici, jamais recopiés d'un autre environnement) ------
AUTH_SECRET="$(openssl rand -hex 32)"
MAGIC_LINK_SECRET="$(openssl rand -hex 32)"
BADGE_HMAC_SECRET="$(openssl rand -hex 32)"

# --- Base de données ------------------------------------------------------
MYSQL_DATABASE="forum_ansd"
MYSQL_USER="forum"
MYSQL_PASSWORD="$MYSQL_PASSWORD"
MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD"
DATABASE_URL="mysql://forum:$MYSQL_PASSWORD@mysql:3306/forum_ansd"

# --- Files d'attente ------------------------------------------------------
REDIS_URL="redis://redis:6379"

# --- Envoi des messages ---------------------------------------------------
# Compte Gmail du Forum (README, section « Envoi des e-mails »). Le mot de
# passe est un mot de passe **d'application**, pas celui du compte.
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="forumansd@gmail.com"
SMTP_PASSWORD="à-coller-ici"
SMTP_FROM="Forum international sur les données <forumansd@gmail.com>"

# --- Stockage des fichiers ------------------------------------------------
STORAGE_DRIVER="local"
STORAGE_LOCAL_PATH="/app/storage"

# --- Anti-robot (PLAN.md C4 — clés non fournies à ce jour) ----------------
TURNSTILE_SITE_KEY=""
TURNSTILE_SECRET_KEY=""
EOF

chmod 600 .env
```

Puis **vérifier que les cinq secrets sont bien là**, sans les afficher : chaque
commande doit répondre le nombre indiqué en commentaire.

```bash
grep -cE '^(MYSQL_PASSWORD|MYSQL_ROOT_PASSWORD)="[0-9a-f]{32}"$' .env              # 2
grep -cE '^(AUTH_SECRET|MAGIC_LINK_SECRET|BADGE_HMAC_SECRET)="[0-9a-f]{64}"$' .env # 3
grep -cE '^DATABASE_URL="mysql://forum:[0-9a-f]{32}@mysql:3306/forum_ansd"$' .env  # 1
```

Les secrets sont tirés en **hexadécimal** : un `$` dans un fichier `.env` est
interprété par Docker Compose, et un mot de passe amputé de sa fin produit une
erreur de connexion dont la cause ne saute pas aux yeux.

`DATABASE_URL` désigne `mysql` et `REDIS_URL` désigne `redis` : ce sont les noms
des services dans le réseau Docker, pas `localhost` — depuis le conteneur de
l'application, `localhost` serait elle-même.

**Vérifier que le serveur peut joindre Gmail** avant de compter dessus : les
réseaux d'entreprise ferment souvent le port 587 en sortie.

```bash
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/smtp.gmail.com/587' && echo "SMTP joignable" || echo "SMTP bloqué : voir la DSI"
```

Sans SMTP, **aucun administrateur ne peut se connecter** : le second facteur
passe par la boîte mail (PLAN.md §23).

### 2.3 Construire et démarrer

```bash
cd /opt/forum-ansd
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

La construction dure une dizaine de minutes la première fois. Pour éviter de la
retaper, poser un alias une fois pour toutes :

```bash
echo "alias forum='docker compose -f /opt/forum-ansd/docker-compose.prod.yml'" >> ~/.bashrc
source ~/.bashrc
```

La suite de ce document utilise cet alias.

> **Un seul `-f`, et c'est important.** Pendant la recette interne, ces
> commandes passaient en plus `docker-compose.interne.yml`, qui remplace la
> configuration nginx par une version sans TLS. Le portail étant servi en HTTPS
> depuis le 24 septembre 2026, ajouter cette surcouche coupe le port 443 : les
> visiteurs reçoivent `ERR_CONNECTION_REFUSED`, et le serveur, lui, ne signale
> rien puisque tous les conteneurs démarrent normalement. Constaté le
> 25 septembre 2026, sur un redéploiement fait en recopiant l'ancienne version
> de ce paragraphe. Si le cas se reproduit :
>
> ```bash
> docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
> ```

### 2.4 Créer le schéma et les données de référence

```bash
cd /opt/forum-ansd
forum run --rm outils pnpm prisma migrate deploy
forum run --rm outils pnpm db:seed
```

Ces deux commandes passent par le service `outils` et non par l'application :
l'image de production ne contient que le serveur compilé, sans la ligne de
commande Prisma. `outils` reprend l'étage de construction, qui l'a, et
disparaît dès la commande terminée (`--rm`).

Le seed pose l'édition, les rôles, les catégories, les zones d'accès, les
salles, les modèles de messages et les textes par défaut — **et rien d'autre** :
aucune donnée de démonstration en production, le seed les y refuse.

**Il ne sert qu'une fois, sur une base vide.** Depuis le 19 octobre 2026, dès
qu'une édition existe, il s'arrête sans rien écrire. Le relancer sur le portail
en service est donc sans effet — mais ne sert à rien non plus : une donnée à
ajouter à une base existante passe par une migration (§4.1).

**`run` n'utilise pas le code que vous venez de tirer.** Le service `outils`
embarque une copie du dépôt figée au moment où son image a été construite, et
`docker compose run` réutilise cette image sans la reconstruire. Une migration
tirée à l'instant n'est pas dans l'image tant qu'elle n'a pas été reconstruite
(`forum build outils`) — `scripts/deployer.sh` le vérifie.

### 2.5 Créer le premier administrateur

**`prenom.nom@ansd.sn` et `MotDePasseLongEtUnique` sont des exemples à
remplacer**, pas des valeurs à coller. L'adresse doit être une boîte réelle et
relevée : la 2FA envoie un code à chaque connexion, et un compte dont l'adresse
n'existe pas est un compte dont personne ne pourra jamais ouvrir la session. Le
mot de passe, lui, est publié ici — c'est donc le contraire d'un secret.

Les deux valeurs sont d'abord posées dans des variables, ce qui rend l'oubli
impossible : un placeholder laissé en l'état arrête la commande au lieu de
créer le compte.

```bash
ADMIN_EMAIL="prenom.nom@ansd.sn"          # ← la vraie adresse
ADMIN_PASSWORD='MotDePasseLongEtUnique'   # ← le vrai mot de passe, 12 car. minimum
case "$ADMIN_EMAIL$ADMIN_PASSWORD" in *prenom.nom*|*MotDePasseLongEtUnique*)
  echo "Exemples non remplacés — commande abandonnée." ;; *)
  forum run --rm outils pnpm create:admin "$ADMIN_EMAIL" "$ADMIN_PASSWORD" SUPER_ADMIN ;;
esac
unset ADMIN_PASSWORD
```

L'appel à `create:admin` tient sur **une seule ligne** : coupée par un `\`, elle
part sans ses arguments dès que la première moitié est collée seule, et le
script se contente d'afficher son aide.

Les guillemets **simples** autour du mot de passe ne sont pas décoratifs : entre
guillemets doubles, un `!` déclenche l'expansion d'historique de bash et modifie
le mot de passe sans rien dire.

Si un compte a malgré tout été créé avec les valeurs d'exemple, le supprimer —
il n'a rien fait dont le journal d'audit doive garder la trace :

```bash
forum exec mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
  -e "DELETE FROM User WHERE email = \"prenom.nom@ansd.sn\";"'
```

Une installation faite **avant le 19 octobre 2026** a reçu en plus le compte de
démonstration `superadmin@ansd.sn`, dont le mot de passe est publié dans le
README, et tout le jeu de démonstration : `pnpm demo:purger` les retire (§4.2).

### 2.6 Vérifier

```bash
forum ps
curl -I http://localhost/            # 200 attendu
curl -s http://localhost/api/health  # état de l'application
```

Depuis un poste du réseau : <http://10.7.200.41/>, BackOffice sur
<http://10.7.200.41/admin>. La connexion envoie un code à l'adresse du compte —
c'est le moment de vérifier que le message arrive.

---

## 3. Sauvegardes

Sans sauvegarde, un disque perdu emporte les inscriptions. La tâche quotidienne
est fournie ; elle écrit dans `/opt/forum-ansd/backups`.

```bash
cd /opt/forum-ansd
crontab -l 2>/dev/null | cat - scripts/backup.cron | crontab -
crontab -l | tail -1        # vérifier que la ligne est bien là
```

Aucun `sudo` : la tâche écrit son journal dans `backups/backup.log`, que
l'utilisateur du déploiement possède déjà.

Lancer une sauvegarde tout de suite, et **la restaurer une fois** pour vérifier
qu'elle vaut quelque chose :

```bash
chmod +x scripts/*.sh        # sur un clone où le bit d'exécution s'est perdu
( set -a && . ./.env && set +a && COMPOSE_FILE="docker-compose.prod.yml" ./scripts/backup.sh )
ls -lh backups/
```

`Permission denied` sur `./scripts/backup.sh` veut dire exactement cela : le
fichier est là, mais sans le bit d'exécution. Le `chmod` ci-dessus le remet, et
la tâche cron, qui appelle le script de la même manière, en dépend aussi.

Les sauvegardes restent sur le serveur : les copier ailleurs (partage ANSD,
disque externe) fait partie de la procédure, pas du script.

---

## 4. Vivre avec le portail

| Besoin                       | Commande                                                              |
| ---------------------------- | --------------------------------------------------------------------- |
| Voir l'état                  | `forum ps`                                                            |
| Suivre les journaux          | `forum logs -f app`                                                   |
| Redémarrer l'application     | `forum restart app`                                                   |
| Arrêter tout                 | `forum down` (les données restent dans les volumes ; **jamais `-v`**) |
| Changer une valeur du `.env` | `forum up -d app` — voir l'avertissement plus bas                     |
| Mettre à jour                | voir ci-dessous                                                       |

Changer un secret ou une adresse dans le `.env` ne demande **aucune
reconstruction** : les valeurs sont injectées au démarrage du conteneur, pas
au moment de la construction de l'image. Un `forum up -d app` suffit. Si
Compose répond « Running » au lieu de « Recreated », il n'a rien vu changer —
lire l'avertissement sur les parenthèses, quelques lignes plus bas, et vérifier
dans le conteneur plutôt que dans le fichier :

```bash
forum exec app printenv SMTP_HOST SMTP_USER SMTP_FROM
```

Mise à jour après une évolution du code :

```bash
cd /opt/forum-ansd && ./scripts/deployer.sh
```

Le script enchaîne, en s'arrêtant à la première étape qui échoue : sauvegarde,
comptage des données, `git pull`, construction des images `app` **et**
`outils`, contrôle que `outils` embarque toutes les migrations, relecture des
migrations (§4.1), redémarrage de l'application, `prisma migrate deploy`, puis
second comptage. Une table qui a perdu des lignes est signalée, avec la
sauvegarde à restaurer. Le script ne lance **jamais** le seed ni aucun script
de contenu.

En dépannage, les mêmes étapes à la main :

```bash
cd /opt/forum-ansd
( set -a && . ./.env && set +a && ./scripts/backup.sh )   # d'abord la sauvegarde
git pull
forum build app outils
forum run --rm outils pnpm migrations:verifier            # refuse une migration destructrice
forum up -d app
forum run --rm outils pnpm prisma migrate deploy
```

L'ordre compte : la sauvegarde d'abord, les migrations après le démarrage de la
nouvelle image — elles sont écrites pour elle.

**`outils` se reconstruit avec l'application, pas après.** C'est lui qui porte
les migrations : resté sur son ancienne image, il répond « No pending
migrations to apply » alors que la nouvelle application attend des colonnes
qui n'existent pas encore — et chaque page tombe en « Application error: a
server-side exception ». Constaté le 29 septembre 2026 : l'image `outils`
comptait 16 migrations, le code déployé 18. Le nombre annoncé par la commande
(« N migrations found ») doit être celui du dossier `prisma/migrations` :

```bash
ls -d prisma/migrations/*/ | wc -l
```

Le chargement du `.env` n'est pas facultatif : `backup.sh` s'arrête net sans
`MYSQL_DATABASE`, `MYSQL_USER` et `MYSQL_PASSWORD`, qu'un shell interactif ne
connaît pas de lui-même. Les migrations, elles, sont idempotentes : la commande
ne coûte rien quand la mise à jour n'en apporte aucune.

**Les parenthèses ne sont pas décoratives.** Chargé dans le shell courant, le
`.env` y **exporte** toutes ses valeurs — et Docker Compose fait passer les
variables du shell **avant** le fichier `.env`. Un `forum up` lancé ensuite
résout donc l'ancien contenu, ne voit aucun changement et laisse le conteneur
en place : la modification paraît appliquée alors qu'elle ne l'est pas.
Constaté le 22 septembre 2026 sur un changement de `SMTP_PASSWORD`, où Compose
répondait « Running » au lieu de « Recreated ». Le sous-shell meurt avec la
sauvegarde et n'en laisse rien derrière lui.

**Sections ajoutées à l'accueil.** Une mise à jour ne modifie pas l'accueil
d'une installation dont la page a déjà été réglée en BackOffice : c'est la base
qui la pilote. Un nouveau type de section arrive dans le catalogue du BackOffice
(Paramètres → Sections de l'accueil, « Ajouter »), et c'est le comité qui le
place. Les scripts `section:*` et `illustrer:accueil` restent disponibles pour
amorcer une installation, **jamais** dans une mise à jour, et toujours précédés
de leur `--essai`.

**Nouvelle permission : se reconnecter.** Les droits d'un compte BackOffice
sont lus à la connexion. Quand une mise à jour ajoute une permission aux rôles
(ainsi « Accréditer la presse », 29 septembre 2026, donnée par migration aux
rôles Super Administrateur, Administrateur Forum et Gestionnaire
Participants), les personnes déjà connectées ne la voient qu'après s'être
déconnectées puis reconnectées.

### 4.1 Ce qui protège les données de production

La règle, depuis le 19 octobre 2026 : **participants, invitations, délégations,
badges, programme, contenus et réglages ne changent que par le BackOffice.** Une
mise à jour apporte du code et, au besoin, des tables ou des colonnes ; elle ne
retire ni ne réécrit rien de ce qui existe.

| Ce qui pourrait arriver                            | Ce qui l'empêche                                                                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le seed rejoué sur le portail en service           | Il ne s'exécute que sur une base vide : dès qu'une édition existe, il s'arrête sans rien écrire (`prisma/seed-decision.ts`).                                            |
| Des données de démonstration écrites en production | Refusées par le seed et par `comptes:demo` quand `APP_ENV=production` (posé en dur dans `docker-compose.prod.yml`) ou quand l'adresse publique est sur `ansd.sn`.       |
| Une migration qui supprime ou réécrit des données  | Relue avant d'être appliquée (`pnpm migrations:verifier`, lancé par `deployer.sh`, et par les tests) : voir ci-dessous.                                                 |
| `prisma migrate reset`, `migrate dev`, `db push`   | Refusées en production par `prisma.config.ts` : la première vide la base, les deux autres peuvent le faire. Seule `migrate deploy` s'emploie sur le serveur.            |
| Une perte de lignes que personne ne remarque       | `deployer.sh` compte les fiches avant et après, et désigne la sauvegarde prise juste avant.                                                                             |
| La base supprimée avec ses volumes                 | **Aucune garde logicielle.** Ne jamais lancer `forum down -v`, `docker volume rm`, `docker volume prune` ni `docker system prune --volumes` : `mysql_data` est la base. |

**Écrire une migration de données.** Une migration ne peut que remplir : un
`UPDATE` se limite, pour chaque colonne qu'il écrit, aux lignes où elle est
encore vide (`` `colonne` IS NULL ``) ou encore égale à son texte d'origine
(`` `colonne` = '…' ``) — une retouche faite en BackOffice ne correspond plus à
la condition et n'est donc jamais écrasée. `DELETE`, `TRUNCATE`, `DROP TABLE`,
`DROP COLUMN`, `REPLACE` et `ON DUPLICATE KEY UPDATE` sont refusés. Une
exception se justifie par écrit, juste au-dessus de l'instruction :

```sql
-- garde-donnees: colonne remplacée par le second facteur par e-mail, plus lue depuis septembre
ALTER TABLE `User` DROP COLUMN `totpSecret`;
```

Les règles sont dans `prisma/garde-migrations.ts`. Elles s'appliquent aux
migrations écrites à partir du 19 octobre 2026 ; les précédentes ont déjà tourné
sur la base de production.

### 4.2 Retirer les données de démonstration

Une installation faite avant le 19 octobre 2026 a reçu du seed tout le jeu de
démonstration : 18 participants fictifs — dont certains sur des domaines réels
(`@ansd.sn`, `@unfpa.org`…), que les rappels et les newsletters atteindraient —,
13 invitations, 2 délégations, 8 intervenants, 28 séances, 2 hôtels,
10 partenaires, 3 actualités, et le compte `superadmin@ansd.sn` au mot de passe
publié.

`pnpm demo:purger` les retrouve à partir de leur source même
(`prisma/donnees-demo.ts`), **inventorie d'abord**, et ne touche à rien sans
`--appliquer` :

```bash
cd /opt/forum-ansd
git pull && ./scripts/deployer.sh                              # la première fois : apporte le script
forum run --rm -T outils pnpm demo:purger | tee backups/demo-inventaire.txt
```

L'inventaire a deux parties :

- **À retirer** : ce qui est certainement de la démonstration — les fiches du
  jeu, intactes depuis le seed ou déjà supprimées en BackOffice, les huit
  intervenants inventés du jeu **même retouchés** (photo, séance, présentation),
  et les adresses qui ne peuvent appartenir à personne (`.test`,
  `@demo.ansd.sn`) ;
- **Conservé — à vérifier** : ce qui y ressemble mais a été touché — une séance
  de démonstration retouchée, peut-être reprise pour le vrai programme ; un
  partenaire du jeu auquel on a ajouté un logo ; une séance où de vrais
  participants sont inscrits ; un participant nommé « Test ». Rien n'y est fait.

Après relecture, une sauvegarde, puis l'application :

```bash
( set -a && . ./.env && set +a && ./scripts/backup.sh )
forum run --rm -T outils pnpm demo:purger --appliquer
forum restart app                                               # vide les caches de pages
```

Pour trancher un cas, identifiant par identifiant (ceux de l'inventaire) :
`--inclure <id,…>` retire aussi une fiche « à vérifier », `--garder <id,…>`
épargne une fiche « à retirer ».

Une fiche d'essai saisie à la main, sans aucune marque, se désigne par son
nom — le BackOffice ne supprime ni participant ni intervenant :

```bash
forum run --rm -T outils pnpm demo:purger --participant "Oumar Ba"
forum run --rm -T outils pnpm demo:purger --intervenant "Prénom Nom" --participant "Autre Nom"
```

Accents, casse et ordre prénom/nom sont ignorés ; les options se répètent.
Seul à porter ce nom, le participant est retiré avec l'invitation à son adresse.
Plusieurs homonymes : tous passent « à vérifier », avec leur adresse et leur
date d'inscription, et `--inclure <id>` désigne le bon. Un nom que personne ne
porte arrête le script sans rien faire. Les mêmes options se répètent avec
`--appliquer`.

Ce que fait `--appliquer` : les envois en attente vers ces fiches sont retirés
de la file **en premier** (un rappel programmé partirait sinon), puis tout est
supprimé dans une seule transaction avec ce qui en dépend (badges, scans,
inscriptions aux séances), enfin les fichiers (badges, logos) sont effacés. Les
comptes de démonstration qui ont agi sont désactivés plutôt que supprimés, pour
que le journal d'audit garde leurs actions ; le dernier super-administrateur
actif n'est jamais touché — créer d'abord un compte nominatif (§2.5). Une entrée
`demo.purge` au journal récapitule l'opération. Les données de référence
(salles, zones, catégories, rôles, modèles d'e-mails, contacts, textes) restent.

### 4.3 Charger le programme officiel

Le programme de la note conceptuelle du 24 septembre 2026 — ouverture, dix
panels, synthèse, distinctions, clôture, et les pauses qui comblent les trous de
l'horaire — est décrit dans `prisma/programme-officiel.ts`. Il se charge une
fois, **après** le retrait du programme fictif (§4.2) :

```bash
cd /opt/forum-ansd
forum run --rm -T outils pnpm programme:officiel                # inventaire
( set -a && . ./.env && set +a && ./scripts/backup.sh )
forum run --rm -T outils pnpm programme:officiel --appliquer
```

Les séances sont créées **publiées et sans réservation**, par le même service
que le formulaire du BackOffice (validation, journal d'audit). Le script ne
crée ni ne renomme aucune salle : « Amphithéâtre » et « Salle plénière » sont
cherchées sous leur nom, puis sous ceux du seed (« Salle d'Ouverture », « Salle
de Plénière ») ; l'inventaire dit laquelle est retenue, et un renommage se fait
en BackOffice.

**Création seulement**, et rejouable : une séance déjà chargée, ou saisie à la
main le même jour sous le même titre ou le même numéro de panel, est gardée
telle quelle ; une séance chargée puis supprimée en BackOffice n'est pas
recréée. Les retouches du comité après le chargement ne sont jamais écrasées.

Les intervenants se rattachent ensuite par l'import (Intervenants → Importer) :
colonne `seances` = numéro du panel, par exemple `4` ou `4; 7`.

---

## 5. HTTPS sur `forum2026.ansd.sn`

En place depuis le 24 septembre 2026. Cette section décrit ce qui tourne, la
date qu'il faut surveiller, et les pièges rencontrés en chemin.

> **Le certificat a sa propre fiche : `docs/CERTIFICAT.md`.** Elle porte le
> remplacement, le retour en arrière, les contrôles et le repli Let's Encrypt.
> C'est elle qu'on ouvre en novembre, quand il s'agira de renouveler. Ce
> chapitre-ci raconte la bascule et ce qu'elle a coûté.

### 5.1 Ce qui sert le portail aujourd'hui

Le domaine a été arrêté le 22 septembre 2026, et la DSI a fourni le certificat
deux jours plus tard. Ce n'est pas un certificat propre au portail : c'est le
**joker `*.ansd.sn` de l'ANSD**, signé par GlobalSign, celui qui couvre déjà les
autres services de la maison. Il est reconnu par tous les navigateurs, ce qui
règle la question de l'ouverture au public.

| Élément              | Valeur                                        |
| -------------------- | --------------------------------------------- |
| Nom couvert          | `*.ansd.sn`, donc `forum2026.ansd.sn`         |
| Autorité             | GlobalSign GCC R3 DV TLS CA 2020              |
| Emplacement          | `/opt/forum-ansd/docker/certs/ansd.{crt,key}` |
| Monté dans nginx sur | `/etc/nginx/certs`, en lecture seule          |
| Expiration           | **20 novembre 2026, 15h15 UTC**               |

Le dossier `docker/certs` est **exclu du dépôt** : il porte la clé privée du
domaine, et pas seulement celle du portail. Une clé divulguée ne se corrige pas,
elle se révoque, et la révocation touche tous les services qui s'en servent.

Let's Encrypt n'est donc plus dans la boucle. Le service `certbot` dort sous le
profil `tls` de `docker-compose.prod.yml` (§5.9).

### 5.2 La date à surveiller, et pourquoi elle est un problème

**Le certificat expire le 20 novembre 2026. Le Forum ouvre le 23.** Il manque
trois jours.

Sans remplacement, le portail affichera à chaque visiteur un avertissement de
sécurité en pleine page, pendant les trois jours de l'événement, sur le site où
l'on vient justement chercher son badge. C'est le risque le plus sérieux qui
pèse aujourd'hui sur l'exploitation.

Le renouvellement n'est pas à notre main : le joker appartient au parc, et c'est
la DSI qui le commande. Le message à lui passer tient en une phrase, et il vaut
mieux le passer tôt : « le certificat `*.ansd.sn` expire le 20 novembre, or le
Forum international sur les données se tient du 23 au 25 ; pouvez-vous nous
remettre le certificat renouvelé avant le 13 novembre ? »

Le 13 novembre, et non le 20 : dix jours de marge laissent le temps de
découvrir un problème et de le résoudre, ce qu'une bascule la veille interdit.

**Porter cette date dans un agenda partagé, pas seulement ici.** Un fichier de
procédure ne réveille personne.

### 5.3 Remplacer le certificat

La procédure complète est au chapitre 3 de `docs/CERTIFICAT.md` : sauvegarde de
l'ancien, installation du nouveau, contrôle que la clé correspond bien au
certificat, rechargement sans coupure, et retour en arrière si besoin.

Elle n'est pas reprise ici. Deux copies d'une même procédure finissent toujours
par diverger, et c'est celle qu'on n'a pas relue qui sera ouverte le jour venu.

### 5.4 Droits sur la clé privée

La clé a été déposée en `rw-rw-r--`, donc lisible par tout compte du serveur.
Elle doit l'être par son seul propriétaire :

```bash
chmod 600 /opt/forum-ansd/docker/certs/ansd.key
ls -l /opt/forum-ansd/docker/certs
```

Le conteneur nginx n'en souffre pas : il lit le fichier en root à travers le
montage. Les tests de sécurité de la DSI, eux, relèveront le point.

### 5.5 Adresse du portail — l'étape qu'on oublie

Le certificat ne suffit pas. Tant que `/opt/forum-ansd/.env` annonce l'ancienne
adresse, le portail continue de se croire à cette adresse-là.

```bash
cd /opt/forum-ansd
unset PUBLIC_BASE_URL AUTH_URL
sed -i 's|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL="https://forum2026.ansd.sn"|' .env
sed -i 's|^AUTH_URL=.*|AUTH_URL="https://forum2026.ansd.sn"|' .env
grep -E '^(PUBLIC_BASE_URL|AUTH_URL)=' .env
docker compose -f docker-compose.prod.yml up -d --force-recreate app
```

Aucune reconstruction : ces valeurs sont lues au démarrage du conteneur. Le
`unset` traite le piège du §4, où une variable déjà exportée dans le shell prime
sur le fichier et fait répondre « Running » à Compose au lieu de « Recreated ».

**Ce qu'elle coûte quand on l'oublie.** Constaté le 24 septembre 2026, entre la
pose du certificat et le lendemain : le site public fonctionnait, le BackOffice
était inaccessible. Auth.js tient `AUTH_URL` pour la seule origine légitime. Il
renvoyait donc vers `http://10.7.200.41` après connexion et y déposait son
cookie de session ; nginx redirigeait cette adresse en clair vers HTTPS sur
l'IP, où le certificat porte le nom de domaine et ne correspond plus. La boucle
se refermait là.

La même variable commande les liens des courriels — code de connexion, badge,
newsletter, invitations. Laissée sur une adresse interne, elle produit des liens
qu'un destinataire extérieur ne peut pas ouvrir, sans qu'aucune erreur
n'apparaisse nulle part.

### 5.6 Vérifier

```bash
curl -I https://forum2026.ansd.sn/       # 200 attendu
curl -I http://forum2026.ansd.sn/        # 301 vers https
curl -sI https://forum2026.ansd.sn/admin | grep -i '^location'
```

La dernière ligne doit renvoyer vers `/connexion` **sur le domaine**. Si elle
mentionne une adresse IP, le §5.5 n'a pas été fait, ou le conteneur `app` n'a
pas été recréé.

Le scanner de badges allume sa caméra à partir de là : les navigateurs réservent
`getUserMedia` aux origines sécurisées, et la lecture des QR était impossible
tant que le portail était servi en clair. C'est le moment de la répétition
d'accueil.

### 5.7 L'alias `forum`, et le piège qu'il tend

Pendant la recette interne, l'alias chargeait **deux** fichiers Compose, dont la
surcouche `docker-compose.interne.yml`. Celle-ci remplace la configuration nginx
par une version sans TLS. La passer aujourd'hui remet le portail en clair, et
sans rien signaler : le port 80 répond normalement, le site s'affiche, seule
l'adresse a perdu son cadenas.

L'alias ne doit donc plus charger que la production :

```bash
sed -i '/alias forum=/d' ~/.bashrc
echo "alias forum='docker compose -f /opt/forum-ansd/docker-compose.prod.yml'" >> ~/.bashrc
source ~/.bashrc
alias forum
```

### 5.8 Reconnexion obligatoire

Le changement d'adresse invalide les sessions ouvertes du BackOffice. Prévenir
les personnes concernées plutôt que de les laisser croire à une panne.

### 5.9 Repli : un certificat propre au portail

Si la DSI ne renouvelait pas le joker à temps, ou le retirait, Let's Encrypt
délivre un certificat propre au portail, reconnu de tous. Le défi DNS, le défi
HTTP et le réveil du service `certbot` sont décrits au chapitre 9 de
`docs/CERTIFICAT.md`.

---

## 6. Avant l'ouverture au public — liste de contrôle

- [x] HTTPS en place (§5), redirection depuis HTTP vérifiée — 24 septembre 2026
- [x] certificat **reconnu publiquement** : joker `*.ansd.sn` signé GlobalSign,
      et non l'autorité interne de l'ANSD, qui n'est connue que du parc (§5.1)
- [ ] **certificat renouvelé avant le 13 novembre 2026** : celui en service
      expire le 20 novembre, trois jours avant l'ouverture du Forum (§5.2)
- [ ] date d'expiration portée dans un agenda partagé, et non dans ce seul
      fichier, tant que le renouvellement automatique n'est pas rétabli (§5.2)
- [ ] clé privée en `chmod 600` — déposée en `rw-rw-r--` (§5.4)
- [ ] alias `forum` ramené au seul fichier de production, sans quoi un
      `forum up -d` remet le portail en clair sans le signaler (§5.7)
- [ ] tests de sécurité de la DSI passés, avant l'ouverture des ports
- [ ] administrateurs réels créés, données et compte de démonstration retirés
      (`pnpm demo:purger`, §4.2) — avant tout rappel ou newsletter, qui
      partiraient aussi vers les adresses de démonstration
- [ ] mises à jour faites par `./scripts/deployer.sh`, jamais par `db:seed` (§4.1)
- [ ] mot de passe du compte super-administrateur changé depuis celui saisi au
      déploiement (§2.5)
- [ ] `.env` en `chmod 600`, secrets générés sur le serveur, jamais versionnés
- [ ] envoi d'e-mails vérifié depuis le serveur (un code de connexion reçu)
- [ ] sauvegarde quotidienne active **et restaurée une fois** pour de vrai
- [ ] clés Turnstile renseignées, ou absence assumée (PLAN.md C4)
- [ ] volumétrie Gmail vérifiée si la campagne dépasse 500 invitations par jour
      (README, section « Envoi des e-mails »)
