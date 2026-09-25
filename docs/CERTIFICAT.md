# Certificat TLS du portail `forum2026.ansd.sn`

Tout ce qui concerne le certificat : ce qui est en service, quand il expire,
comment le remplacer, comment revenir en arrière, et les pièges déjà rencontrés.

La procédure de déploiement générale est dans `DEPLOIEMENT.md`. Ce document-ci
est celui qu'on ouvre quand il est question du certificat, et lui seul.

---

## 1. L'essentiel

|                   |                                                                   |
| ----------------- | ----------------------------------------------------------------- |
| Nom couvert       | `*.ansd.sn`, donc `forum2026.ansd.sn`                             |
| Autorité          | GlobalSign GCC R3 DV TLS CA 2020                                  |
| Type              | joker du parc ANSD, partagé avec les autres services de la maison |
| Certificat        | `/opt/forum-ansd/docker/certs/ansd.crt`                           |
| Clé privée        | `/opt/forum-ansd/docker/certs/ansd.key`                           |
| Vu par nginx sous | `/etc/nginx/certs`, monté en lecture seule                        |
| Déclaré dans      | `docker/nginx.conf`, bloc `listen 443`                            |
| Posé le           | 24 septembre 2026, par la DSI                                     |
| **Expire le**     | **20 novembre 2026, 15h15 UTC**                                   |

Le certificat n'appartient pas au portail. C'est le joker de l'ANSD, que la DSI
commande et renouvelle pour l'ensemble du parc. Nous ne pouvons ni le générer,
ni en déclencher le renouvellement : nous le recevons et nous l'installons.

---

## 2. La date, et ce qu'il faut demander

**Le certificat expire le 20 novembre 2026. Le Forum se tient du 23 au 25.**
Il manque trois jours.

Sans remplacement, chaque visiteur reçoit un avertissement de sécurité en pleine
page, pendant les trois jours de l'événement, sur le site où l'on vient chercher
son badge. C'est le risque d'exploitation le plus sérieux identifié à ce jour.

| Échéance            | Quoi                                    |
| ------------------- | --------------------------------------- |
| Dès maintenant      | poser la demande à la DSI               |
| 13 novembre 2026    | avoir le nouveau certificat **en main** |
| 20 novembre 2026    | l'ancien cesse d'être valide            |
| 23–25 novembre 2026 | Forum                                   |

La cible du 13 novembre, et non du 20, laisse dix jours pour découvrir un
problème et le résoudre. Une bascule la veille n'en laisse aucun.

Le message à passer à la DSI tient en une phrase :

> Le certificat `*.ansd.sn` expire le 20 novembre 2026, or le Forum
> international sur les données se tient du 23 au 25 novembre et le portail
> `forum2026.ansd.sn` s'appuie dessus. Pouvez-vous nous remettre le certificat
> renouvelé, certificat et clé privée, avant le 13 novembre ?

**Porter la date dans un agenda partagé, pas seulement dans ce fichier.** Un
document de procédure ne réveille personne.

---

## 3. Remplacer le certificat

Sans coupure : `nginx -s reload` laisse les connexions en cours se terminer et
ne redémarre pas le conteneur. Aucune reconstruction d'image, aucun redémarrage
de l'application.

```bash
cd /opt/forum-ansd

# 1. Garder l'ancien à portée de main
cp docker/certs/ansd.crt docker/certs/ansd.crt.bak
cp docker/certs/ansd.key docker/certs/ansd.key.bak

# 2. Installer le nouveau
cp /chemin/vers/nouveau.crt docker/certs/ansd.crt
cp /chemin/vers/nouveau.key docker/certs/ansd.key
chmod 644 docker/certs/ansd.crt
chmod 600 docker/certs/ansd.key

# 3. Vérifier que la clé va bien avec le certificat
openssl x509 -in docker/certs/ansd.crt -pubkey -noout | openssl md5
openssl pkey -in docker/certs/ansd.key -pubout        | openssl md5

# 4. Valider la configuration, puis recharger
docker compose -f docker-compose.prod.yml exec nginx nginx -t
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

# 5. Contrôler ce qui est réellement servi sur le réseau
echo | openssl s_client -connect forum2026.ansd.sn:443 -servername forum2026.ansd.sn 2>/dev/null \
  | openssl x509 -noout -subject -issuer -enddate
```

**Les deux empreintes de l'étape 3 doivent être identiques.** C'est le seul
contrôle qui détecte une clé dépareillée, et nginx démarre avec une telle clé
sans jamais dire pourquoi : les visiteurs voient une erreur de protocole, les
journaux ne montrent rien d'anormal.

L'étape 5 interroge le serveur à travers le réseau, et non le fichier sur le
disque. C'est elle qui prouve que le rechargement a réellement pris effet.

Supprimer les deux fichiers `.bak` une fois le nouveau certificat validé : une
clé privée de moins qui traîne sur le disque.

```bash
rm -f /opt/forum-ansd/docker/certs/ansd.crt.bak /opt/forum-ansd/docker/certs/ansd.key.bak
```

---

## 4. Revenir en arrière

Si le contrôle échoue ou si le site ne répond plus, tant que les `.bak` sont là.

```bash
cd /opt/forum-ansd
cp docker/certs/ansd.crt.bak docker/certs/ansd.crt
cp docker/certs/ansd.key.bak docker/certs/ansd.key
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

Si `exec` répond que le conteneur ne tourne pas, c'est qu'il boucle sur un
échec de démarrage. Le rechargement ne s'applique alors pas, il faut le
recréer :

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
docker compose -f docker-compose.prod.yml logs --tail=15 nginx
```

---

## 5. Vérifier, à tout moment

Ce qui est servi sur le réseau, la réponse qui fait foi :

```bash
echo | openssl s_client -connect forum2026.ansd.sn:443 -servername forum2026.ansd.sn 2>/dev/null \
  | openssl x509 -noout -subject -issuer -enddate
```

Ce que contient le fichier sur le disque :

```bash
openssl x509 -in /opt/forum-ansd/docker/certs/ansd.crt -noout -subject -issuer -dates
```

L'état du conteneur et ses derniers messages :

```bash
cd /opt/forum-ansd
docker compose -f docker-compose.prod.yml ps nginx
docker compose -f docker-compose.prod.yml logs --tail=20 nginx
```

Les trois adresses qui doivent fonctionner :

```bash
curl -sI https://forum2026.ansd.sn/ | head -1              # 200
curl -sI http://forum2026.ansd.sn/  | grep -i '^location'  # vers https
curl -sI http://10.7.200.41/        | grep -i '^location'  # vers le domaine
```

La troisième mérite un mot. Le bloc du port 80 redirige vers le **nom de
domaine écrit en dur**, et non vers l'adresse demandée. Qui ouvre l'adresse IP
par habitude atterrit ainsi sur le domaine, au lieu d'être renvoyé vers HTTPS
sur une adresse IP que le certificat ne couvre pas.

---

## 6. Surveiller l'échéance

Répond sans détour, et convient à une vérification mensuelle :

```bash
openssl x509 -in /opt/forum-ansd/docker/certs/ansd.crt -noout -checkend $((30*24*3600)) \
  && echo "OK : encore valide dans 30 jours" \
  || echo "ALERTE : expire dans moins de 30 jours"
```

Changer `30` pour la fenêtre voulue. Le code de retour vaut zéro tant que le
certificat reste valide au-delà du délai, ce qui permet d'en faire une tâche
planifiée qui n'écrit que lorsqu'il y a lieu de s'inquiéter.

---

## 7. Sauvegarder hors du serveur

Le dossier `docker/certs` est **exclu du dépôt**, et c'est délibéré : il porte
la clé privée du domaine, pas seulement celle du portail. Une clé divulguée ne
se corrige pas, elle se révoque, et la révocation frappe tous les services de
l'ANSD qui s'appuient sur ce joker.

La contrepartie est qu'il n'existe **aucune copie de secours dans le dépôt**.
Copier les deux fichiers là où sont gardées les sauvegardes de la base, et les
traiter avec le même soin : accès restreint, et jamais de dépôt distant.

```bash
cp /opt/forum-ansd/docker/certs/ansd.crt /opt/forum-ansd/backups/
cp /opt/forum-ansd/docker/certs/ansd.key /opt/forum-ansd/backups/
chmod 600 /opt/forum-ansd/backups/ansd.key
```

Le dossier `backups` est lui aussi exclu du dépôt, pour la même raison qu'un
dump de base : il contient des données qui n'ont rien à faire sur un dépôt
distant.

---

## 8. Ce qu'il ne faut pas faire

Quatre pièges, tous constatés le 25 septembre 2026, et tous coûteux.

**Ne jamais supprimer le dossier `docker/certs`.** S'il n'existe pas au moment
où le conteneur démarre, Docker le recrée lui-même, vide et appartenant à root.
Nginx ne trouve plus rien à lire, refuse de démarrer, et boucle. Le compte
courant ne peut alors même plus écrire dans le dossier.

```bash
# Reprendre la main si le cas se présente, sans droits d'administration
docker run --rm -v /opt/forum-ansd/docker:/w alpine chown -R "$(id -u):$(id -g)" /w/certs
```

**Ne jamais lancer `git add -A` sur le serveur.** C'est ainsi que la clé privée
s'est retrouvée dans un commit local, et le dump de la base trois jours plus
tôt. Le `.gitignore` couvre désormais les deux cas, mais la règle de fond reste
que le serveur reflète le dépôt et ne produit pas de commits.

**Ne jamais modifier les fichiers suivis directement sur le serveur.** Le dépôt
et le serveur divergent alors en silence, et le premier vrai `git pull` refuse
de s'exécuter. Toute modification passe par le dépôt, puis par un `git pull`.

**Ne plus passer `docker-compose.interne.yml`.** Cette surcouche remplace la
configuration nginx par une version sans TLS. La passer aujourd'hui remet le
portail en clair sans rien signaler : le port 80 répond, le site s'affiche,
seul le cadenas a disparu. L'alias `forum` doit ne charger que le fichier de
production.

```bash
alias forum    # doit afficher un seul -f, celui de docker-compose.prod.yml
```

---

## 9. Si le certificat venait à manquer

Cas de repli, à n'employer que si la DSI ne renouvelle pas à temps ou retire le
joker. Let's Encrypt délivre en quelques minutes un certificat reconnu de tous,
valable quatre-vingt-dix jours, propre au portail.

Tant que le serveur n'est pas joignable depuis Internet, seul le défi **DNS**
fonctionne : Let's Encrypt ne demande alors aucun fichier sur le serveur, mais
un enregistrement `TXT` dans la zone `ansd.sn`. La commande s'interrompt et
attend ; il faut donc avoir la DSI disponible au même moment, le défi expirant
au bout de quelques dizaines de minutes.

```bash
cd /opt/forum-ansd
docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot certbot \
  certonly --manual --preferred-challenges dns \
  -d forum2026.ansd.sn --agree-tos -m forum@ansd.sn --no-eff-email
```

Certbot affiche une chaîne. La DSI crée `_acme-challenge.forum2026.ansd.sn`, de
type `TXT`, avec cette valeur exacte. **Vérifier avant d'appuyer sur Entrée** :

```bash
dig +short TXT _acme-challenge.forum2026.ansd.sn @8.8.8.8
```

Une validation lancée trop tôt échoue, et Let's Encrypt limite le nombre
d'échecs par domaine et par heure.

Le certificat atterrit dans le volume `certbot_conf`, que nginx voit sous
`/etc/letsencrypt`. Il reste à faire pointer `docker/nginx.conf` vers
`/etc/letsencrypt/live/forum2026.ansd.sn/fullchain.pem` et `privkey.pem` — les
deux chemins sont rappelés en commentaire juste au-dessus de ceux en service —
puis à recharger nginx comme au chapitre 3.

Une fois le serveur ouvert depuis Internet, le défi **HTTP** redevient possible,
et avec lui le renouvellement sans intervention. Le vérifier d'abord depuis un
poste hors du réseau de l'ANSD, puis :

```bash
docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  -d forum2026.ansd.sn --agree-tos -m forum@ansd.sn --no-eff-email --force-renewal
docker compose -f docker-compose.prod.yml --profile tls up -d certbot
```

Le service `certbot` dort sous le profil `tls` : il ne démarre pas avec la pile,
mais reste une définition valide que Compose vérifie, et qu'un `run --rm`
réveille pour une émission manuelle.

---

## 10. Où se trouve quoi

| Fichier                      | Rôle                                               |
| ---------------------------- | -------------------------------------------------- |
| `docker/certs/ansd.crt`      | le certificat, hors dépôt                          |
| `docker/certs/ansd.key`      | la clé privée, hors dépôt, `chmod 600`             |
| `docker/nginx.conf`          | déclare les deux chemins, bloc `listen 443`        |
| `docker-compose.prod.yml`    | monte `docker/certs` en lecture seule sur nginx    |
| `docker-compose.interne.yml` | surcouche sans TLS, à ne plus passer               |
| `.gitignore`                 | exclut `/docker/certs/` et `/backups/`             |
| `docs/DEPLOIEMENT.md`        | la procédure de déploiement, chapitre 5 pour HTTPS |
