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
docker compose exec app pnpm db:seed
```

- App : http://localhost:3000
- Mailpit (emails de dev) : http://localhost:8025
- MinIO (stockage S3, optionnel) : `docker compose --profile storage up`

`docker-compose.yml` est le compose de **développement** (app en mode `pnpm dev` avec
rechargement à chaud, + MySQL, Redis, Mailpit, MinIO en option). `docker-compose.prod.yml`
est celui de **production** (image buildée en mode standalone, + MySQL, Redis, nginx +
Let's Encrypt, sans Mailpit/MinIO) — cf. `PLAN.md` décision C5.

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
pnpm db:seed
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

Créé par `pnpm db:seed`, à changer immédiatement en dehors d'un environnement de
développement local :

| Rôle                          | Email                | Mot de passe                                                    |
| ----------------------------- | -------------------- | --------------------------------------------------------------- |
| Super Administrateur `[DEMO]` | `superadmin@ansd.sn` | `ChangeMe!Forum2026` (ou `SEED_SUPER_ADMIN_PASSWORD` si défini) |

Ce compte porte un rôle soumis au second facteur : sa connexion envoie un code à l'adresse
`superadmin@ansd.sn`. En local, le message arrive dans Mailpit (http://localhost:8025).

## Données de seed

`prisma/seed.ts` est idempotent (`pnpm db:seed` peut être relancé sans dupliquer les
données) et couvre à ce stade la structure de référence : 1 édition (`FID-2026`), 8 rôles
BackOffice avec leurs permissions, 1 super admin, 11 catégories de participants, 7 zones
d'accès et leur matrice catégorie × zone, 7 niveaux de sponsors, 7 modèles de notification
(clés du Lot 1). Le contenu de démonstration volumineux (sessions, intervenants, 300
participants `[DEMO]`) sera ajouté au fil de l'implémentation des modules correspondants
(cf. `PLAN.md`, TODO T10).

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

| Variable        | En local (défaut)       | Compte Gmail du Forum                                       |
| --------------- | ----------------------- | ----------------------------------------------------------- |
| `SMTP_HOST`     | `forum-ansd-mailpit`    | `smtp.gmail.com`                                            |
| `SMTP_PORT`     | `1025`                  | `587`                                                       |
| `SMTP_USER`     | _(absent : pas d'auth)_ | `forumansd@gmail.com`                                       |
| `SMTP_PASSWORD` | _(absent)_              | mot de passe **d'application** Google (16 caractères)       |
| `SMTP_FROM`     | `… <forum@ansd.sn>`     | `Forum international sur les données <forumansd@gmail.com>` |

- **Mot de passe d'application obligatoire** : Google refuse le mot de passe du compte en
  SMTP. Il faut activer la validation en deux étapes, puis créer un mot de passe
  d'application (Compte Google → Sécurité). Il ne va **que** dans `.env.docker` (local) ou
  dans le `.env` du serveur, tous deux hors dépôt.
- **L'adresse de `SMTP_FROM` doit être celle du compte** : Gmail réécrit sinon
  l'expéditeur, et le message part avec une adresse différente de celle annoncée.
- **Port 587 seulement** : `mail.ts` ouvre la connexion en clair puis passe en TLS
  (STARTTLS). Le port 465, chiffré d'emblée, demanderait une variable `SMTP_SECURE`.
- **Basculer en local** : décommenter le bloc Gmail de `.env.docker`, commenter les lignes
  Mailpit, puis **`./scripts/stack.sh --recreer`**. L'option est indispensable : sans elle,
  le script laisse tourner le conteneur existant, qui garde les anciennes variables — une
  image à jour lui suffit. Les messages partent alors pour de vrai et ne s'affichent plus
  dans Mailpit : **les tests E2E, qui lisent Mailpit, échouent tant que Gmail est actif**.
  À remettre sur Mailpit après l'essai.

**Limites d'un compte Gmail gratuit**, à connaître avant la campagne d'invitations :
environ 500 destinataires par jour, et des envois en rafale que Google peut refuser (le
portail met un message en file par destinataire, sans cadence). Pour plus de 500
participants, il faut le SMTP de l'ANSD ou un service d'envoi (Brevo, Mailjet, Amazon SES)
configuré sur le domaine `ansd.sn` — mêmes cinq variables.

## Scripts

| Commande                       | Effet                                     |
| ------------------------------ | ----------------------------------------- |
| `pnpm dev`                     | Serveur de développement Next.js          |
| `pnpm build`                   | Build de production                       |
| `pnpm lint`                    | ESLint                                    |
| `pnpm format` / `format:check` | Prettier (écrit / vérifie)                |
| `pnpm typecheck`               | Vérification TypeScript (`tsc --noEmit`)  |
| `pnpm test`                    | Tests Vitest (unitaires + intégration DB) |
| `pnpm prisma:migrate`          | Nouvelle migration Prisma (dev)           |
| `pnpm prisma:generate`         | Régénère le client Prisma                 |
| `pnpm db:seed`                 | Rejoue le seed de référence               |

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
