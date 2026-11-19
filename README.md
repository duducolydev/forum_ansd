# Portail Forum international sur les données — ANSD

Plateforme web du Forum international sur les données de l'ANSD (23–25 novembre 2026, Hôtel King Fahd Palace, Dakar) :
site vitrine, espace participant, BackOffice de pilotage, application de scan d'accès.

Référence normative : [`docs/BRIEF_Claude_Code_Portail_Forum_ANSD.md`](docs/BRIEF_Claude_Code_Portail_Forum_ANSD.md).
Suivi d'avancement, décisions et TODO : [`PLAN.md`](PLAN.md).

> État actuel : Lot 0 (Socle) en voie d'achèvement — monorepo, schéma Prisma migré et
> seedé, authentification BackOffice + second facteur par e-mail + RBAC, journal d'audit,
> i18n FR/EN,
> layouts public/admin/scanner, files/jobs, CI et Docker sont en place. Le contenu réel
> des pages (site public, programme, BackOffice complet) arrive avec le Lot 1 — cf.
> `PLAN.md` §3.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · Prisma 7
(MySQL, via l'adaptateur `@prisma/adapter-mariadb`) · Auth.js v5 (bêta) · BullMQ/Redis
(repli sans Redis : `DbJobQueue`) · next-intl · Vitest.

## Démarrage avec Docker (recommandé)

```bash
cp .env.example .env   # renseigner au moins AUTH_SECRET, MAGIC_LINK_SECRET, BADGE_HMAC_SECRET
docker compose up
```

Puis, dans un autre terminal, une fois les conteneurs démarrés :

```bash
docker compose exec app pnpm prisma migrate deploy
docker compose exec -e SEED_DEMO=1 app pnpm db:seed   # SEED_DEMO=1 : avec le jeu de démonstration
```

- App : http://localhost:3000
- Mailpit (emails de dev) : http://localhost:8025
- MinIO (stockage S3, optionnel) : `docker compose --profile storage up`

`docker-compose.yml` est le compose de **développement** (app en mode `pnpm dev` avec
rechargement à chaud, + MySQL, Redis, Mailpit, MinIO en option). `docker-compose.prod.yml`
est celui de **production** (image buildée en mode standalone, + MySQL, Redis, nginx +
Let's Encrypt, sans Mailpit/MinIO) — cf. `PLAN.md` décision C5.

**Déployer sur un serveur** : [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) donne la
procédure complète, de l'installation de Docker à la bascule HTTPS, en passant par les
sauvegardes. Le déploiement interne sans domaine utilise en plus
`docker-compose.interne.yml`.

## Démarrer la stack locale (image de production)

Un seul script construit l'image si le code a changé, démarre MySQL, Redis, Mailpit puis
l'application, attend que chacun réponde, applique les migrations et vérifie que le
conteneur tourne bien sur l'image construite :

```bash
./scripts/stack.sh                # démarre tout, en reconstruisant l'image si le code a changé
./scripts/stack.sh --build        # reconstruit l'image même si le code n'a pas changé
./scripts/stack.sh --sans-build   # démarre sans reconstruire, même si le code a changé
./scripts/stack.sh etat           # état des conteneurs, code identique à l'image ou non
./scripts/stack.sh arreter        # arrête tout, sans rien supprimer
./scripts/stack.sh journaux app   # suit les journaux (app, mysql, redis, mailpit)
./scripts/stack.sh aide
```

- Site : http://localhost:3010 · BackOffice : `/admin` · Scanner : `/scan` · Mailpit : http://localhost:8025
- Les variables de l'application (secrets compris) sont lues dans `.env.docker`, **non
  versionné**. Au premier lancement, il est créé à partir du conteneur existant.
- La base n'est **jamais** supprimée. Sur une nouvelle machine, `--creer-base` crée une
  base vide puis charge les données de référence ; sans cette option, un MySQL absent
  arrête le script plutôt que d'en créer un vide sans prévenir.
- Sous Windows, le script lance Docker Desktop s'il ne répond pas, et empêche la mise en
  veille pendant une construction.

## Démarrage sans Docker

```bash
pnpm install
cp .env.example .env   # adapter DATABASE_URL/REDIS_URL à une base MySQL/Redis existantes
pnpm prisma:migrate
SEED_DEMO=1 pnpm db:seed
pnpm dev
```

Si le port 3306 (MySQL) ou 6379 (Redis) est déjà occupé sur la machine, adapter le port
dans `DATABASE_URL`/`REDIS_URL` (le port interne des conteneurs reste inchangé).

> Windows uniquement : `pnpm build` échoue en local avec une erreur `EPERM` sur la
> création de liens symboliques (`.next/standalone`) — limitation connue de pnpm + Next.js
> `output: "standalone"` sur Windows sans mode développeur activé. Le build fonctionne
> normalement dans le conteneur Docker (Linux) : c'est la voie de vérification à utiliser
> sur cette plateforme, `docker build .`.

## Authentification BackOffice et second facteur

Connexion : `/connexion`. Hachage `argon2id`, verrouillage après 5 échecs (15 minutes).

Le **second facteur passe par l'e-mail** pour les rôles `SUPER_ADMIN` et `ADMIN_FORUM`
(PLAN.md §23) : le mot de passe accepté, un message part vers l'adresse du compte avec un
**code à 6 chiffres** à saisir dans la même fenêtre, et un **lien de validation** pour qui
lit son courrier ailleurs. Le code vaut 10 minutes, ne sert qu'une fois, et cinq essais
faux verrouillent le compte comme cinq mots de passe faux. Il n'y a rien à enrôler ni à
réinitialiser par compte : l'adresse suffit.

Deux conséquences à connaître :

- **La boîte mail devient la clé du BackOffice** : qui y accède entre. C'est le prix de ce
  choix, fait en connaissance de cause en remplacement de l'application d'authentification
  (TOTP) prévue au brief §7. Le cahier des charges de l'ANSD (§26) demande deux facteurs
  pour les administrateurs, sans imposer la méthode.
- **Plus d'envoi, plus de connexion** : si le SMTP tombe, les comptes soumis au second
  facteur ne peuvent plus ouvrir de session. Les rôles opérationnels (agents d'accueil,
  scanner) ne sont pas concernés et entrent avec leur seul mot de passe.

## Comptes de démonstration

Créé par `SEED_DEMO=1 pnpm db:seed`, en développement seulement — le seed refuse
les données de démonstration en production, et `pnpm demo:purger` retire ce compte
d'une installation plus ancienne (`docs/DEPLOIEMENT.md` §4.2) :

| Rôle                          | Email                | Mot de passe                                                    |
| ----------------------------- | -------------------- | --------------------------------------------------------------- |
| Super Administrateur `[DEMO]` | `superadmin@ansd.sn` | `ChangeMe!Forum2026` (ou `SEED_SUPER_ADMIN_PASSWORD` si défini) |

Ce compte porte un rôle soumis au second facteur : sa connexion envoie un code à l'adresse
`superadmin@ansd.sn`. En local, le message arrive dans Mailpit (http://localhost:8025).

## Données de seed

`prisma/seed.ts` **ne s'exécute que sur une base vide** : dès qu'une édition existe, il
s'arrête sans rien écrire (en local, `pnpm prisma migrate reset` repart de zéro). Il
pose :

- toujours, les **données de référence** : l'édition `FID-2026`, les rôles BackOffice et
  leurs permissions, les catégories de participants, les zones d'accès et points de
  contrôle, les salles, les niveaux de partenaires, les contacts pratiques, les modèles
  d'e-mails et les textes par défaut ;
- avec `SEED_DEMO=1` (ou `--demo`), et **jamais en production**, le **jeu de
  démonstration** de `prisma/donnees-demo.ts` : participants, invitations, délégations,
  intervenants, programme, hôtels, partenaires, actualités, et le super admin `[DEMO]`.

Une donnée à ajouter à une base existante passe par une migration, que
`prisma/garde-migrations.ts` relit : elle ne peut que remplir des champs vides. Les
protections des données de production sont décrites dans `docs/DEPLOIEMENT.md` §4.1.

## Variables d'environnement

Voir `.env.example` pour la liste complète et commentée. Point d'attention : les secrets
(`AUTH_SECRET`, `MAGIC_LINK_SECRET`, `BADGE_HMAC_SECRET`) livrés dans `.env` local sont
générés aléatoirement pour le développement — **à régénérer avant tout déploiement**, même
de test (`PLAN.md`, TODO T9). Le domaine (`PUBLIC_BASE_URL`) et le SMTP institutionnel ne
sont pas encore fournis par l'ANSD (`PLAN.md`, décisions C6/C7) : la mise en production
réelle en dépend.

## Envoi des e-mails (SMTP)

Notifications, alertes, invitations et liens magiques passent tous par `src/lib/mail.ts` :
seules ces cinq variables changent d'un environnement à l'autre.

| Variable        | En local (défaut)       | Mailjet (production, depuis le 19/11/2026)                  |
| --------------- | ----------------------- | ----------------------------------------------------------- |
| `SMTP_HOST`     | `forum-ansd-mailpit`    | `in-v3.mailjet.com`                                         |
| `SMTP_PORT`     | `1025`                  | `587`                                                       |
| `SMTP_USER`     | _(absent : pas d'auth)_ | **API Key** Mailjet (une clé, pas une adresse)              |
| `SMTP_PASSWORD` | _(absent)_              | **Secret Key** Mailjet                                      |
| `SMTP_FROM`     | `… <forum@ansd.sn>`     | `Forum international sur les données <forum@ansd.sn>`       |
| `SMTP_REPLY_TO` | _(vide)_                | adresse réellement relevée, si ce n'est pas `forum@ansd.sn` |

- **L'identifiant est une clé d'API**, pas une boîte aux lettres : il n'y a plus de mot de
  passe d'application à créer, et rien à activer côté compte Google.
- **`SMTP_FROM` doit appartenir au domaine validé** (`ansd.sn`, statut _Active_ dans
  Mailjet). Contrairement à Gmail, Mailjet **ne réécrit pas** l'expéditeur : les
  participants lisent enfin `forum@ansd.sn` et non une adresse `gmail.com`. C'est le gain
  le plus visible de la bascule.
- **`SMTP_REPLY_TO` si personne ne relève `forum@ansd.sn`** : les réponses sont alors
  renvoyées vers une adresse lue, sans rien changer à l'expéditeur affiché.
- **Port 587 seulement** : `mail.ts` ouvre la connexion en clair puis passe en TLS
  (STARTTLS). Le port 465, chiffré d'emblée, demanderait une variable `SMTP_SECURE`.
- **Les clés ne vont que** dans `.env.docker` (local) ou dans le `.env` du serveur, tous
  deux hors dépôt. Rien de tout cela n'est commité.
- **Basculer en local** : décommenter le bloc Mailjet de `.env.docker`, commenter les
  lignes Mailpit, puis **`./scripts/stack.sh --recreer`**. L'option est indispensable :
  sans elle, le script laisse tourner le conteneur existant, qui garde les anciennes
  variables — une image à jour lui suffit. Les messages partent alors pour de vrai et ne
  s'affichent plus dans Mailpit : **les tests E2E, qui lisent Mailpit, échouent tant que
  Mailjet est actif**. À remettre sur Mailpit après l'essai.

**Authentification du domaine.** Le SPF de `ansd.sn` inclut `spf.mailjet.com`. Le DKIM
Mailjet est en cours de pose par la DSI : son absence ne bloque pas l'envoi, mais elle
coûte des points de réputation — c'est précisément ce que mesure l'essai mail-tester
ci-dessous.

**Limites.** Le plafond n'est plus celui d'une boîte aux lettres (≈500/24 h glissantes
pour un Gmail ordinaire) mais celui du **plan Mailjet souscrit**. Le déclarer dans
`SMTP_PLAFOND_QUOTIDIEN` pour que `pnpm envois:projection` calcule juste : sans lui, la
projection retombe sur 500 et se trompe dans les deux sens. Pour mémoire, l'édition compte
plus de 1 100 inscrits, et une validation en lot envoie **deux** messages par personne.

### Deux boîtes d'envoi

Les courriels ne partent pas tous du même compte (`src/lib/mail.ts`) :

| Voie             | Ce qui y passe                                                | Variables         |
| ---------------- | ------------------------------------------------------------- | ----------------- |
| `transactionnel` | Codes de connexion, confirmations, badges, accusés de contact | `SMTP_*`          |
| `campagne`       | Rappels J-7/J-1, invitations, envois groupés du BackOffice    | `SMTP_CAMPAGNE_*` |

**Pourquoi.** Le 18 novembre 2026, les rappels J-7 partis dans la nuit ont consommé à eux
seuls le quota journalier du compte. Au matin, les confirmations d'inscription et les
badges étaient refusés — `550-5.4.5 Daily user sending limit exceeded` — et les codes de
connexion du BackOffice allaient suivre : **plus personne n'aurait pu s'y connecter**. Deux
comptes rendent les quotas étanches ; une campagne ne peut plus assécher le reste.

Un envoi refusé faute de quota n'est plus réessayé dans la seconde — les trois tentatives
de la file tombaient en quinze secondes et consommaient du quota à chaque fois. Il est
**reporté** de six heures, jusqu'à quatre fois.

`SMTP_CAMPAGNE_*` laissées vides, les campagnes repartent sur la boîte principale : c'est
le comportement du développement (Mailpit) et d'un déploiement pas encore migré. Avec un
second compte Gmail, `SMTP_CAMPAGNE_USER` et `SMTP_CAMPAGNE_PASSWORD` suffisent — l'hôte
est repris, le nom affiché aussi, et les réponses sont renvoyées vers la boîte principale,
la seule que l'équipe relève.

**Depuis Mailjet, les laisser vides est le réglage normal.** Les deux boîtes séparées
répondaient à un problème propre à Gmail : rendre étanches deux quotas de **boîtes aux
lettres**. Un plan souscrit n'a qu'un compteur, que deux comptes ne cloisonneraient pas ;
et le transport mutualisé fait que les deux voies partagent une seule connexion. La
distinction `transactionnel`/`campagne` reste en place dans le code — elle ne coûte rien,
et elle redevient utile le jour où les campagnes repartent d'un autre fournisseur.

**Vérifier les deux boîtes** avant de compter dessus — authentification SMTP, IMAP, et un
message d'essai depuis chacune :

```bash
docker compose -f docker-compose.prod.yml run --rm outils pnpm boites:verifier
docker compose -f docker-compose.prod.yml run --rm outils pnpm boites:verifier moi@ansd.sn
```

Le script n'affiche aucun mot de passe. Il signale aussi le cas où
`SMTP_CAMPAGNE_*` est absente du **conteneur** alors qu'elle est bien dans le `.env` —
le piège de Compose décrit dans le guide de déploiement.

### Noter la délivrabilité (mail-tester)

`boites:verifier` prouve que le message **part**. Il ne dit rien de ce qu'en pensera le
serveur d'en face : SPF, DKIM, réputation de l'adresse IP, équilibre texte/HTML. C'est ce
que note mail-tester, et cela vaut d'être fait avant d'envoyer mille rappels.

1. Ouvrir <https://www.mail-tester.com> et copier l'adresse jetable affichée
   (`test-xxxxxxx@srv1.mail-tester.com`). Elle expire : ne pas la garder d'un jour sur
   l'autre.
2. Envoyer un message d'essai **depuis le serveur**, pour partir de la vraie adresse IP :

   ```bash
   docker compose -f docker-compose.prod.yml run --rm outils \
     pnpm boites:verifier test-xxxxxxx@srv1.mail-tester.com
   ```

3. Revenir sur mail-tester et cliquer **« Vérifier le score »**. Attendre quelques
   secondes : le message n'est analysé qu'une fois arrivé.
4. Lire dans cet ordre, le reste est secondaire :
   - **SPF** doit passer. Il échouerait si `SMTP_FROM` sortait du domaine `ansd.sn`.
   - **DKIM** est le point attendu, la DSI étant en train de le poser. Tant qu'il manque,
     le score plafonne autour de 7/10 sans que rien ne soit cassé.
   - **Liste noire** : une IP mutualisée de Mailjet peut y figurer. C'est à signaler à
     Mailjet, pas à corriger ici.
   - **Contenu** : un message sans version texte perd des points. Les modèles du portail
     en produisent une (`renderHtml` dans `modules/notifications/service.ts`).
5. Refaire l'essai **après** la pose du DKIM, pour confirmer le gain.

Un essai sur un modèle réel plutôt que sur le message du script : BackOffice →
Notifications → Modèles, prévisualiser, puis utiliser l'envoi groupé en se limitant à
l'adresse mail-tester. L'envoi passe alors par toute la chaîne — file, journal, rendu —
et pas seulement par le transport.

### Reprendre les envois en échec

BackOffice → Notifications → Historique, bouton **« Renvoyer les échecs »** : remet en
file les messages restés en échec, une fois par personne et par modèle. Les destinataires
qui ont finalement reçu le message et les adresses qui ont rebondi sont écartés, les
envois sont étalés, et les liens signés (badge, confirmation) sont **refabriqués** — le
journal ne les conserve pas. Les codes de connexion ne sont jamais renvoyés.

### Rebonds différés (« Adresse introuvable »)

Gmail accepte le message, puis le serveur du destinataire le refuse : l'envoi a
« réussi », et l'avis de non-distribution n'arrive qu'ensuite dans la boîte du Forum.
Le serveur relit ces avis **toutes les quinze minutes** par IMAP
(`src/modules/notifications/rebonds.ts`) et les reporte dans l'historique d'envoi
(BackOffice → Notifications → Historique, état « Rebond »), avec le motif et un lien
pour corriger l'adresse d'une invitation. Un bouton « Relever les rebonds » lance la
lecture tout de suite.

- **Ce relevé ne couvre pas les envois Mailjet** (19 novembre 2026). Mailjet traite les
  avis de non-distribution chez lui : ils n'arrivent dans **aucune** boîte aux lettres, et
  il n'y a rien à lire en IMAP. Le bouton « Relever les rebonds » disparaît donc de
  l'historique tant qu'aucun `IMAP_*` n'est renseigné — c'est voulu, et préférable à un
  bouton qui échoue à chaque clic. Récupérer ces rebonds demanderait l'API ou les webhooks
  Mailjet : **chantier distinct, non fait**. En attendant, un envoi qui rebondit reste
  affiché « Envoyé » dans l'historique.
- **Garder l'ancienne boîte Gmail un moment** : les messages partis **avant** la bascule
  y rebondissent encore. Renseigner `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`,
  `IMAP_PASSWORD` dessus suffit à continuer de les recueillir.
- **Rien à configurer avec Gmail** : `smtp.gmail.com` entraîne `imap.gmail.com:993`,
  avec le même compte et le même mot de passe d'application. Les **deux** boîtes sont
  relevées : les avis d'une campagne arrivent dans la boîte de campagne, que personne
  ne consulte. Sans IMAP (Mailpit), le relevé ne tourne pas.
- **Lecture seule** : aucun message n'est déplacé, marqué lu ni supprimé.
- **Le port 993 doit être ouvert en sortie** sur le serveur :
  `timeout 5 bash -c 'cat < /dev/null > /dev/tcp/imap.gmail.com/993' && echo "IMAP joignable"`.
- Seuls les échecs **définitifs** sont retenus ; un « problème temporaire » ne l'est pas,
  Gmail réessaie et enverra un nouvel avis s'il abandonne.

## Corpus public (assistant de recherche)

`GET /api/v1/corpus` livre tout le contenu **publié** du portail, aplati en texte, avec
l'adresse de la page qui le porte : de quoi indexer le site pour un assistant de recherche
sans accès à la base. Un document par contenu et par langue (`?langue=fr,en`),
réindexation partielle par `?depuis=<ISO>`, débit de 6 appels/min/IP, jeton facultatif
(`CORPUS_TOKEN`).

Aucune donnée personnelle n'en sort : les tables de participants, badges, présences et
inscriptions ne sont pas lues, et `src/modules/corpus/construire.test.ts` le vérifie.

Spécification à remettre à l'équipe qui construit l'assistant :
[`docs/ASSISTANT-RECHERCHE.md`](docs/ASSISTANT-RECHERCHE.md).

## Scripts

| Commande                       | Effet                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                     | Serveur de développement Next.js                                                                               |
| `pnpm build`                   | Build de production                                                                                            |
| `pnpm lint`                    | ESLint                                                                                                         |
| `pnpm format` / `format:check` | Prettier (écrit / vérifie)                                                                                     |
| `pnpm typecheck`               | Vérification TypeScript (`tsc --noEmit`)                                                                       |
| `pnpm test`                    | Tests Vitest (unitaires + intégration DB)                                                                      |
| `pnpm prisma:migrate`          | Nouvelle migration Prisma (dev)                                                                                |
| `pnpm prisma:generate`         | Régénère le client Prisma                                                                                      |
| `pnpm db:seed`                 | Initialise une base vide (`SEED_DEMO=1` : + démonstration)                                                     |
| `pnpm demo:purger`             | Inventorie les données de démonstration ; `--appliquer` les retire                                             |
| `pnpm migrations:verifier`     | Refuse une migration qui supprimerait ou réécrirait des données                                                |
| `pnpm corpus:apercu`           | Compte le corpus public et nomme les documents sans texte                                                      |
| `pnpm boites:verifier`         | Authentifie les deux boîtes d'envoi (SMTP + IMAP)                                                              |
| `pnpm organisation:harmoniser` | Inventorie les saisies d'une organisation (participants, intervenants, invitations) ; `--appliquer` les unifie |
| `./scripts/deployer.sh`        | Mise à jour en production, sans toucher aux données                                                            |

Un hook Husky `pre-commit` lance `lint-staged` (ESLint + Prettier sur les fichiers modifiés).

## CI

`.github/workflows/ci.yml` exécute, sur chaque PR : lint, format:check, typecheck, tests
(contre un service MySQL éphémère), build.

## Structure

Voir `docs/BRIEF_Claude_Code_Portail_Forum_ANSD.md` §3.2 pour l'arborescence cible complète.
Repères actuels :

- `src/app/(public)` : site public (pages placeholder à ce stade, contenu réel en Lot 1) +
  `/connexion`.
- `src/app/(participant)/mon-espace`, `src/app/(backoffice)/admin`, `src/app/(scanner)/scan` :
  coquilles des trois autres espaces.
- `src/modules/auth` : règles métier d'authentification (verrouillage, second facteur par
  e-mail) — testées.
- `src/lib` : utilitaires transverses (`db`, `audit`, `queue`, `mail`, `storage`, `qr`, `pdf`,
  `permissions`, `rbac`, `theme`).
- `src/i18n` : i18n sans préfixe d'URL (cookie `NEXT_LOCALE`) — cf. `PLAN.md` §0.5.
