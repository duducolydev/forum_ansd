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

### 4.3 Le programme se gère en BackOffice

**Depuis le 24 octobre 2026, le programme qui fait foi est celui que le comité
a saisi en BackOffice** (Programme), à la place de la note conceptuelle du
24 septembre 2026. Il se modifie là, et nulle part ailleurs : aucune commande ne
le charge ni ne le corrige sur le serveur.

L'ancien chargement de la note (`scripts/programme-officiel.ts`) n'a plus de
commande `pnpm`, et refuse de s'exécuter en production. Relancé sur le
programme du comité, il ajoutait des doublons à côté (ou, avec `--remplacer`,
retirait ses séances). Constaté le 24 octobre 2026 : le comité avait renommé la
salle plénière « Salle Plénière BC12 », le script ne la trouvait plus et s'est
arrêté sans rien écrire.

L'exposition des stands n'est pas une session : la page Programme la signale
sous le titre de chaque journée, ouverte toute la journée.

Les intervenants se rattachent aux séances par l'import (Intervenants →
Importer) : colonne `seances` = numéro de la séance, par exemple `4` ou `4; 7`.

### 4.4 Ouvrir l'export du corpus à l'assistant de recherche

`GET /api/v1/corpus` livre le contenu public du portail à l'assistant de
recherche interne (`docs/ASSISTANT-RECHERCHE.md`). Sans `CORPUS_TOKEN`, la route
est **ouverte** : le contenu qu'elle sert est déjà public page par page, mais un
export d'un bloc invite à l'aspiration automatique.

> **Au premier déploiement, écrire le jeton dans `.env` _avant_ de lancer
> `./scripts/deployer.sh`** : son `forum up -d app` recrée le conteneur et
> reprend la variable au passage. Tout se fait alors en une passe, et la
> recréation manuelle ci-dessous ne sert qu'à ajouter ou changer le jeton sur un
> portail déjà en service.

Pour fermer la route :

```bash
cd /opt/forum-ansd
JETON="$(openssl rand -hex 32)"
: "${JETON:?génération échouée}"
printf '\n# --- Export du corpus (docs/ASSISTANT-RECHERCHE.md) ---------------------\nCORPUS_TOKEN="%s"\n' "$JETON" >> .env
grep -cE '^CORPUS_TOKEN="[0-9a-f]{64}"$' .env   # 1
```

Puis **recréer le conteneur** : `restart` relance le processus avec les
variables qu'il avait déjà, et ne reprend donc pas la nouvelle.

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps app
```

Vérifier que la route est bien fermée, puis ouverte avec le jeton — le premier
appel doit répondre `404`, le second `200` :

```bash
BASE="$(grep '^PUBLIC_BASE_URL=' .env | cut -d'"' -f2)"
HOTE="$(printf '%s' "$BASE" | sed -E 's|^https?://||; s|[:/].*$||')"
echo "$BASE / $HOTE"   # adresse publique du portail, et son seul nom d'hôte

curl -s -o /dev/null -w '%{http_code}\n' --max-time 10 \
  --resolve "$HOTE:443:127.0.0.1" "$BASE/api/v1/corpus"
curl -s -o /dev/null -w '%{http_code}\n' --max-time 10 \
  --resolve "$HOTE:443:127.0.0.1" -H "Authorization: Bearer $JETON" \
  "$BASE/api/v1/corpus"
```

Trois précautions, chacune pour une erreur constatée le 16 novembre 2026 :

- **`--resolve` n'est pas optionnel.** Depuis le serveur, le nom public du
  portail ne mène pas au serveur : il résout vers le Fortinet, qui porte le
  chemin d'entrée des visiteurs et ne renvoie pas la connexion à l'intérieur. La
  commande **reste suspendue** jusqu'au délai, sans rien dire. `--resolve` fait
  parler nginx directement, sur la même origine HTTPS que verra un visiteur.
- **`--max-time`**, pour que ce cas-là rende un `000` en dix secondes au lieu
  d'un terminal figé qu'on finit par interrompre — ce qui ne prouve rien.
- **L'adresse est lue dans le `.env`**, jamais écrite en dur. `http://127.0.0.1/`
  tomberait sur le `server` du port 80, qui ne fait que rediriger
  (`301 https://forum2026.ansd.sn…` — `docker/nginx.conf`) : un `301` ne dit rien
  du jeton et envoie chercher la panne là où elle n'est pas.

Ce contrôle prouve que nginx et la route s'accordent. Il ne prouve pas le chemin
qu'emprunteront les clients : le refaire **depuis un poste du réseau de l'ANSD**,
sans `--resolve`, et attendre le même `404` puis le même `200`.

Transmettre le jeton par un canal séparé de l'adresse, et jamais dans le même
message que la documentation.

**Le piège.** Le service `app` de `docker-compose.prod.yml` énumère ses
variables une à une : une ligne ajoutée au seul `.env` n'atteint pas le
conteneur. `CORPUS_TOKEN` y figure depuis le 16 novembre 2026 — sans cette
ligne, le jeton posé dans `.env` laisserait la route ouverte en donnant à croire
qu'elle est fermée, et rien ne le signalerait. Le `404` du contrôle ci-dessus est
ce qui le prouve.

**Et le contenu ?** `pnpm corpus:apercu` compte le corpus par type et **nomme les
contenus publiés mais vides** — un titre sans texte, indexé tel quel, fait
remonter une page vide en réponse à une vraie question. À passer avant
d'annoncer l'export, puis après chaque campagne de saisie :

```bash
docker compose -f docker-compose.prod.yml run --rm outils pnpm corpus:apercu
```

Lecture seule : le script n'écrit rien en base.

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

Relevé sur le certificat en service le 16 novembre 2026 — et non recopié d'une
commande passée : c'est ainsi que ce tableau a vieilli de trois semaines sans
que personne s'en aperçoive.

| Élément              | Valeur                                                                             |
| -------------------- | ---------------------------------------------------------------------------------- |
| Nom couvert          | `*.ansd.sn`, donc `forum2026.ansd.sn`                                              |
| Autorité             | GlobalSign GCC R46 DV TLS CA 2025                                                  |
| Emplacement          | `/opt/forum-ansd/docker/certs/fullchainansd.crt` + `ansd.key`                      |
| Monté dans nginx sur | `/etc/nginx/certs`, en lecture seule                                               |
| Émis le              | 29 octobre 2026, 14h32 UTC                                                         |
| Expiration           | **16 mai 2027, 14h32 UTC**                                                         |
| Chaîne               | complète : feuille + intermédiaire GlobalSign (vérifié le 16 novembre 2026, §5.11) |

Pour le relire à tout moment :

```bash
openssl x509 -noout -subject -issuer -dates -in docker/certs/fullchainansd.crt
```

Le dossier `docker/certs` est **exclu du dépôt** : il porte la clé privée du
domaine, et pas seulement celle du portail. Une clé divulguée ne se corrige pas,
elle se révoque, et la révocation touche tous les services qui s'en servent.

Let's Encrypt n'est donc plus dans la boucle. Le service `certbot` dort sous le
profil `tls` de `docker-compose.prod.yml` (§5.9).

### 5.2 La date à surveiller — levée le 29 octobre 2026

> **Résolu.** Le certificat en service a été renouvelé et court jusqu'au
> **16 mai 2027**. L'échéance du 20 novembre 2026, qui tombait trois jours avant
> l'ouverture du Forum et constituait le risque d'exploitation le plus sérieux du
> projet, n'existe plus. Vérifié le 16 novembre 2026 :
>
> ```bash
> openssl x509 -noout -subject -issuer -dates -in docker/certs/fullchainansd.crt
> # subject=CN=*.ansd.sn
> # issuer=C=BE, O=GlobalSign nv-sa, CN=GlobalSign GCC R46 DV TLS CA 2025
> # notBefore=Oct 29 14:32:28 2026 GMT
> # notAfter=May 16 14:32:28 2027 GMT
> ```
>
> Ce certificat porte bien sa chaîne. nginx, lui, ne l'avait pas relue pendant
> une semaine : voir §5.11, à lire avant tout dépôt de certificat.
> **Prochaine échéance à porter dans un agenda partagé : le 16 mai 2027.**

Ce qui suit reste la raison d'être de cette surveillance, et vaudra à la
prochaine expiration.

Sans remplacement, le portail affiche à chaque visiteur un avertissement de
sécurité en pleine page, sur le site où l'on vient justement chercher son badge.
Le renouvellement n'est pas à notre main : le joker appartient au parc, et c'est
la DSI qui le commande. Le message à lui passer tient en une phrase, et il vaut
mieux le passer tôt — **dix jours avant**, et non la veille : ce délai laisse le
temps de découvrir un problème et de le résoudre.

**Porter la date dans un agenda partagé, pas seulement ici.** Un fichier de
procédure ne réveille personne — et c'est bien ce qui s'est produit dans l'autre
sens : le certificat a été renouvelé le 29 octobre sans que ce guide l'apprenne,
et il a continué trois semaines à annoncer une échéance dépassée.

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

### 5.10 Ce nginx sert aussi SISEP

Depuis le 28 octobre 2026, le nginx du portail relaie aussi
`sisephasaoc.ansd.sn` : SISEP, le suivi-évaluation du PHASAOC, installé sur le
même serveur dans `/opt/sisep`. Les ports 80 et 443 de ce nginx sont les seuls
du serveur, et SISEP n'en publie aucun sur le réseau. Son bloc est dans
`docker/nginx-sisephasaoc.conf`, monté à côté de `nginx.conf`. Le mode
opératoire complet est dans le dépôt de SISEP (`docs/deploiement-production.md`,
§4).

Ce que cela change pour le portail :

- **Le certificat.** Le joker couvre les deux noms. Le remplacement décrit dans
  `docs/CERTIFICAT.md` sert les deux sites d'un coup ; l'expiration aussi les
  arrête ensemble.
- **Un SISEP arrêté ne gêne pas le portail.** nginx résout `sisep-web` à chaque
  requête, et non au démarrage : seul `sisephasaoc.ansd.sn` répond alors 502.
- **Le réseau.** Le conteneur `web` de SISEP est raccordé à
  `forum-ansd_default`. Tant qu'il y est, `forum down` ne peut pas supprimer ce
  réseau : Compose le signale et le laisse en place, ce qui est sans
  conséquence pour le `forum up -d` suivant.
- **La surcouche `docker-compose.interne.yml`** (§5.7) ne remplace que
  `default.conf`. Passée, elle laisserait donc le port 443 ouvert, sur SISEP
  seul : un visiteur du portail en HTTPS tomberait sur SISEP.

### 5.11 nginx servait un certificat qu'il avait en mémoire (16 novembre 2026)

**Le symptôme.** Depuis le serveur, `curl` refuse la connexion au portail, alors
qu'un navigateur l'ouvre sans rien signaler :

```
curl: (60) SSL certificate OpenSSL verify result:
      unable to get local issuer certificate (20)
```

Le même appel avec `-k` répond normalement, et nginx ne présente **qu'un seul
certificat** :

```bash
echo | openssl s_client -connect 127.0.0.1:443 -servername forum2026.ansd.sn   -showcerts 2>/dev/null | grep -c "BEGIN CERTIFICATE"
```

**La cause, et ce n'est pas celle qu'on croit.** Le fichier sur le disque était
**déjà complet** — feuille puis intermédiaire, dans le bon ordre :

```bash
openssl crl2pkcs7 -nocrl -certfile docker/certs/fullchainansd.crt   | openssl pkcs7 -print_certs -noout
```

C'est **nginx** qui servait l'ancien contenu. Il lit ses certificats au
démarrage et les garde en mémoire : le certificat renouvelé a été déposé le
9 novembre, le conteneur tournait depuis plus longtemps, et il a continué une
semaine à présenter la version précédente — à un seul certificat. Un
`nginx -s reload` a tout réglé.

C'est le même piège qu'au §5.7, et il mérite d'être énoncé une fois pour toutes :

> **Remplacer un fichier que nginx a déjà lu ne change rien tant que nginx ne
> l'a pas relu.** Vrai pour `default.conf`, vrai pour les certificats.
> `./scripts/deployer.sh` ne recrée nginx que si sa **configuration** diffère de
> celle du dépôt : un certificat déposé à la main ne déclenche donc rien.

```bash
cd /opt/forum-ansd
docker compose -f docker-compose.prod.yml exec nginx nginx -t
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
# Si le rechargement ne suffit pas, recréer :
docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps nginx
```

**Pourquoi personne ne l'avait vu pendant une semaine.** Un navigateur rattrape
un intermédiaire manquant tout seul — il le tient d'une visite précédente, ou va
le chercher par l'extension AIA du certificat. Les visiteurs ne voyaient donc
rien. **Un client HTTP, non** : `curl`, un script, un indexeur, un robot de
supervision échouent tous à la vérification et concluent que le portail est en
panne. Le défaut n'a été découvert qu'en branchant une API — celle de l'export du
corpus (§4.4).

**Vérifier**, sans `-k` :

```bash
cd /opt/forum-ansd
curl -sS -o /dev/null -w 'portail : %{http_code}
' --max-time 10   --resolve forum2026.ansd.sn:443:127.0.0.1 https://forum2026.ansd.sn/
echo | openssl s_client -connect 127.0.0.1:443 -servername forum2026.ansd.sn   -showcerts 2>/dev/null | grep -c "BEGIN CERTIFICATE"
```

Attendu : une réponse sans erreur TLS, et `2` certificats présentés.

Recréer nginx touche aussi **SISEP**, servi par le même conteneur (§5.10) :
contrôler les deux noms.

```bash
curl -sS -o /dev/null -w 'SISEP : %{http_code}
' --max-time 10   --resolve sisephasaoc.ansd.sn:443:127.0.0.1 https://sisephasaoc.ansd.sn/
```

#### Si le fichier est réellement incomplet

Le cas ne s'est pas présenté ici, mais il se traite ainsi. L'émetteur est une
autorité **publique** et le certificat porte l'adresse de son émetteur dans son
extension AIA : l'intermédiaire se récupère seul, sans passer par la DSI.

```bash
cd /opt/forum-ansd
URL="$(openssl x509 -noout -text -in docker/certs/fullchainansd.crt   | sed -n 's|.*CA Issuers - URI:||p' | head -1)"
echo "$URL"        # http://secure.globalsign.com/cacert/… attendu

curl -fsS --max-time 20 -o /tmp/inter.brut "$URL"
# Le fichier arrive en DER ou en PEM selon l'autorité : on tente les deux.
openssl x509 -inform DER -in /tmp/inter.brut -out /tmp/inter.pem 2>/dev/null   || cp /tmp/inter.brut /tmp/inter.pem
openssl x509 -noout -subject -issuer -in /tmp/inter.pem
```

Le `subject` de l'intermédiaire doit être **exactement** l'`issuer` du
certificat du portail. Sans accès sortant depuis le serveur, faire ces commandes
depuis un poste et déposer `inter.pem` : c'est un certificat public, il n'y a
rien à protéger.

L'assemblage se fait **feuille d'abord, intermédiaires ensuite** — l'ordre
qu'exige `ssl_certificate` — et par un bloc **enchaîné de `&&`**, chaque étape
conditionnant la suivante :

```bash
cd /opt/forum-ansd
test -s /tmp/inter.pem   && openssl verify -untrusted /tmp/inter.pem docker/certs/fullchainansd.crt   && sudo cp -a docker/certs/fullchainansd.crt "docker/certs/fullchainansd.crt.bak-$(date +%F)"   && cat docker/certs/fullchainansd.crt /tmp/inter.pem > /tmp/chaine.pem   && sudo cp /tmp/chaine.pem docker/certs/fullchainansd.crt   && echo "chaîne posée"
```

Quatre détails, chacun pour une erreur commise le 16 novembre 2026 :

- **l'enchaînement par `&&` n'est pas du zèle.** Le bloc d'origine vérifiait
  _après_ avoir assemblé : collé sans que le téléchargement ait eu lieu, le `cat`
  a écrit la feuille seule et le `mv` l'a reposée en place, sans que rien le
  signale. Une étape qui ne peut pas bloquer la suivante ne vérifie rien ;
- **`sudo`** : le fichier appartient à `root`, et le dossier est écrivable par
  l'exploitant — on peut donc y créer une sauvegarde sans pouvoir remplacer le
  certificat, ce qui donne un `Permission denied` à la dernière étape seulement ;
- **l'assemblage passe par `/tmp`**, jamais sur le fichier en service : une
  redirection `>` vide sa cible avant de la lire, et `cat fullchain… >
fullchain…` ne laisserait rien ;
- **`cp` et non `mv`** : `cp` écrit _dans_ le fichier existant et lui garde son
  propriétaire et ses droits, là où `mv` lui impose ceux du fichier temporaire —
  et demande à confirmer un changement de mode, question à laquelle on répond
  sans la lire.

Puis recharger nginx, comme ci-dessus. `docker/certs` est monté comme **dossier**
— le fichier remplacé est vu immédiatement dans le conteneur —, mais cela ne
dispense pas du rechargement : c'est tout l'objet de cette section.

---

## 6. Avant l'ouverture au public — liste de contrôle

- [x] HTTPS en place (§5), redirection depuis HTTP vérifiée — 24 septembre 2026
- [x] certificat **reconnu publiquement** : joker `*.ansd.sn` signé GlobalSign,
      et non l'autorité interne de l'ANSD, qui n'est connue que du parc (§5.1)
- [x] **certificat renouvelé** : renouvelé par la DSI le 29 octobre 2026, valide
      jusqu'au 16 mai 2027 — l'échéance du 20 novembre n'existe plus (§5.2)
- [x] **chaîne du certificat servie en entier** : nginx présentait la feuille
      seule — un fichier pourtant complet, mais qu'il n'avait pas relu depuis le
      dépôt du 9 novembre. Corrigé par un rechargement le 16 novembre 2026 ;
      vérifier après tout dépôt de certificat (§5.11)
- [ ] date d'expiration (16 mai 2027) portée dans un agenda partagé, et non dans
      ce seul fichier, tant que le renouvellement automatique n'est pas rétabli (§5.2)
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
