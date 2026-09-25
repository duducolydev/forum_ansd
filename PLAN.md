# PLAN — Portail Web du Forum international sur les données (ANSD)

> Découpage en tâches des **Lots 0, 1 et 2**, conformément à l'ordre de travail du brief (§15). Le Lot 3 (Capitalisation) sera détaillé à l'approche de son échéance.
> Référence normative : `docs/BRIEF_Claude_Code_Portail_Forum_ANSD.md`. En cas de divergence avec `docs/Spécifications fonctionnelles proposées.docx`, le brief fait foi.
> État au 7 septembre 2026 : Lot 0 (0.1 à 0.8) complet. **Lot 1 : modules 3.1 à 3.9 complets**,
> 3.10 (mise en production) fait pour tout ce qui ne dépend pas de l'ANSD. **Lot 2 : chantiers
> 4.1 à 4.10 faits.** Reste **4.11**, la répétition générale — un exercice à organiser, pas du code.
> **229 tests unitaires et 61 tests de bout en bout au vert**, dont un qui coupe réellement le
> réseau pour éprouver le scanner hors ligne, un qui met vingt candidats en concurrence sur une
> place unique, et un qui extrait l'archive ZIP avec l'outil du système.
> Lighthouse : accessibilité et SEO à 100 sur les huit pages publiques auditées.
> Contradictions levées en codant : C9, C12, C13, C14. Restent ouvertes C10 et C11.
> Écarts au brief assumés et mesurés : T36 (scan orange), plafond du PDF de rapport (4.9),
> `vipQuota` réservé au placement manuel (4.5), ISR remplacé par un cache de données (C13),
> glisser-déposer non fait (T43).
> Réserves : T23, T26, T30, T31, T33 (intermittence de la suite unitaire sur cette machine),
> T40, T41, k6 écrit mais non exécuté, `docker compose up` (dev) non re-testé.
> Bloqué sur l'ANSD : T1 (hébergement, domaine, **TLS vers MySQL** et HTTPS du scanner),
> T2 (SMTP), T3 (logos), T4 (clés CAPTCHA), T5, T23, C9, le `vipQuota` et le contenu du §23.
> Prochaine étape : faire arbitrer par l'ANSD ce qui reste ouvert (C9, C10, C11, `vipQuota`,
> §23, textes légaux), obtenir T1 à T4, puis **programmer la répétition générale**.
> participants.
> de session posé au 4.4 — et porte le test de concurrence exigé par le brief.
> remplissage par salle laissée en attente au 4.6.
> scans que 4.2 produit désormais).
> restantes.

---

## 0. Contradictions et points à clarifier avant de coder

Conformément à la consigne « signale toute contradiction avant de coder », voici ce qui mérite une décision ou une confirmation. Faute de retour de l'ANSD, j'avance avec la **colonne « Décision par défaut »** — à corriger si elle ne convient pas.

| #   | Sujet                                                                    | Constat                                                                                                                                                                                                                                                                                                                                                                                    | Décision par défaut (si aucun retour)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Priorité              |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| C1  | **Calendrier Lot 0 très serré**                                          | Le Lot 0 (§14) doit livrer monorepo + Prisma + auth 2FA + RBAC + audit + i18n + layout + CI + Docker pour le **8 septembre**, soit 6 jours à partir d'aujourd'hui.                                                                                                                                                                                                                         | Le Lot 0 est traité **intégralement**, sans restriction de périmètre : les huit chantiers 0.1 à 0.8 sont tous requis, pas seulement le chemin minimal « site vide + admin connecté ». Si le calendrier se révèle intenable en cours de route, je le signalerai explicitement à ce moment-là plutôt que de décider maintenant, par anticipation, de retirer des éléments du Lot 0.                                                                                                                                                            | Haute                 |
| C2  | **Session participant après lien magique**                               | Le modèle de données (§4) définit `MagicLink` (jeton à usage unique, 30 min) mais aucune table de session participant. Or l'espace `/mon-espace` doit rester accessible plusieurs jours (§5.3 : « modifiable jusqu'à J-3 »).                                                                                                                                                               | Après consommation du lien magique, émission d'un **cookie de session JWT httpOnly** (dans le même style que la session admin), signé, à expiration glissante (ex. 30 jours), stocké côté client uniquement — pas de nouvelle table. Le `code6` de secours suit la même logique.                                                                                                                                                                                                                                                             | Haute                 |
| C3  | **Identité visuelle et logos réels**                                     | Logos ANSD/Forum, charte officielle non fournis (§13 : « placeholders [À CONFIRMER] »).                                                                                                                                                                                                                                                                                                    | Utiliser le bloc-marque géométrique du template (`.brand .mark`) comme placeholder vectoriel, variables `--ansd-*` centralisées dans `src/app/globals.css` (Tailwind v4 est CSS-first, pas de `tailwind.config.ts`) pour remplacement en un point unique.                                                                                                                                                                                                                                                                                    | Moyenne               |
| C4  | **CAPTCHA / anti-bot**                                                   | §5.3 impose reCAPTCHA/Turnstile mais aucune clé n'est fournie.                                                                                                                                                                                                                                                                                                                             | Interface `CaptchaProvider` avec implémentation `NoopCaptchaProvider` par défaut en dev (toujours valide) ; le rate-limit + honeypot restent actifs indépendamment. Clé Turnstile à brancher dès réception par l'ANSD.                                                                                                                                                                                                                                                                                                                       | Moyenne               |
| C5  | **Services dev vs prod dans Docker**                                     | §3.1 liste `docker-compose.yml` (app, mysql, redis, nginx) ; §11 mentionne Mailpit en dev et MinIO optionnel, non listés dans le compose.                                                                                                                                                                                                                                                  | `docker-compose.yml` (dev) = app, mysql, redis, mailpit, minio (optionnel, profil `storage`) ; `docker-compose.prod.yml` = app, mysql, redis, nginx, sans mailpit/minio (SMTP et storage réels).                                                                                                                                                                                                                                                                                                                                             | Basse                 |
| C6  | **Hébergement / nom de domaine**                                         | §13 : VPS Ubuntu 24 + Docker, domaine fourni par l'ANSD — non reçu à ce jour.                                                                                                                                                                                                                                                                                                              | Développement et Lot 1 avancent en local/staging avec domaine provisoire (`*.localhost` / sous-domaine de test) ; le passage en production Lot 1 (§14 : « Inscriptions ouvertes en production ») reste bloqué tant que l'hébergement définitif n'est pas fourni. **Ceci est un vrai risque de calendrier**, à signaler à l'ANSD dès que possible.                                                                                                                                                                                            | Bloquante (hors code) |
| C7  | **SMTP institutionnel**                                                  | §13 : SMTP ANSD ou repli Brevo — aucun des deux configuré.                                                                                                                                                                                                                                                                                                                                 | Développement avec Mailpit ; prévoir la variable d'environnement `SMTP_*` documentée dans `.env.example`, à renseigner avant mise en production.                                                                                                                                                                                                                                                                                                                                                                                             | Moyenne               |
| C8  | **`next-auth` v5 encore en bêta**                                        | Le brief demande explicitement « Auth.js (NextAuth v5) » (§3.1). Au moment de l'implémentation, le paquet `next-auth` n'a **aucune version 5 stable publiée** — seule une bêta (`5.0.0-beta.32`) existe, la balise `latest` pointant toujours vers la v4 (moins adaptée à l'App Router).                                                                                                   | Utiliser `next-auth@5.0.0-beta.32` comme demandé explicitement par le brief plutôt que rétrograder vers la v4 : cette bêta est largement utilisée en production dans l'écosystème Next.js App Router depuis longtemps. Point à surveiller lors des mises à jour de dépendances (API encore susceptible de changer).                                                                                                                                                                                                                          | Moyenne               |
| C9  | **Vérification hors ligne du badge par le scanner**                      | §5.6 demande une vérification de la signature HMAC **côté client**, avec « une clé dérivée valable 24 h ». Or le HMAC est symétrique : la clé qui permet de _vérifier_ permet aussi de _fabriquer_. Livrer cette clé au navigateur d'un agent, c'est permettre à quiconque accède à l'appareil de forger des badges valides pendant 24 h — exactement ce que la signature devait empêcher. | **Ne pas envoyer de clé au client.** Le manifeste embarque l'**empreinte SHA-256 du token** de chaque badge valide ; le scanner hache le QR lu et cherche l'empreinte. Vérification hors ligne complète, sans qu'aucun secret ne quitte le serveur, et forgerie impossible. Si l'ANSD tient à une vraie signature vérifiable hors ligne, l'alternative propre est une signature **asymétrique** (Ed25519) : le serveur signe, le scanner vérifie avec la clé publique. À arbitrer, la solution par empreinte étant suffisante pour le Lot 2. | **Haute (sécurité)**  |
| C10 | **« Manifeste chiffré » en IndexedDB**                                   | §5.6 parle d'un manifeste chiffré stocké côté client. Le chiffrement suppose une clé ; si elle accompagne l'application, elle est lisible par qui inspecte l'appareil et le chiffrement ne protège de rien.                                                                                                                                                                                | Ne pas prétendre chiffrer. Le manifeste n'est servi qu'à un agent authentifié, IndexedDB est cloisonné par origine, et le contenu est **réduit au strict nécessaire** (§2.11 : ni e-mail, ni téléphone). La protection réelle est là. À signaler explicitement à l'ANSD plutôt que de livrer un chiffrement décoratif.                                                                                                                                                                                                                       | Moyenne               |
| C11 | **Poids du manifeste hors ligne**                                        | §5.6 prévoit une photo miniature 96 px par participant, rechargée « au login et toutes les 10 min ». À 1 500 participants (§8), cela représente environ 8 Mo par cycle et par appareil — intenable sur la connexion d'un site de conférence, avec six points de contrôle.                                                                                                                  | Manifeste **incrémental** : un premier chargement complet, puis seulement les changements depuis un horodatage. Photos servies **séparément et à la demande**, mises en cache par le navigateur, et jamais bloquantes pour le verdict de scan. Cible : moins de 500 Ko par synchronisation en régime établi.                                                                                                                                                                                                                                 | Haute                 |
| C12 | ~~**levée au chantier 4.3**~~ — **Espace intervenant et lien magique**   | §5.8 prévoit un espace intervenant par lien magique, mais le lien magique du Lot 1 est adossé à `Participant`. Or `Speaker.participantId` est **facultatif** : un intervenant peut n'être lié à aucun participant.                                                                                                                                                                         | Étendre `MagicLink` à un destinataire de type intervenant plutôt que d'imposer la création d'un participant : un panéliste qui dépose sa présentation n'est pas nécessairement inscrit au Forum. Décision à consigner au moment du chantier 4.3.                                                                                                                                                                                                                                                                                             | Moyenne               |
| C13 | ~~**tranchée au chantier 4.10**~~ — **ISR 60 s sur les pages publiques** | §8 demande un cache ISR de 60 s. Impossible en l'état : le thème et la langue sont lus dans les **cookies** par le gabarit, ce qui force le rendu dynamique de toutes les pages. C'est aussi l'origine probable de la performance en retrait de l'accueil (T35).                                                                                                                           | Deux voies : (a) déplacer le thème côté client (script en ligne avant peinture, au prix d'un risque de scintillement) et la langue dans l'URL, ce qui rend l'ISR possible ; (b) conserver le rendu dynamique et se contenter d'un cache de données. À arbitrer au chantier 4.10, en même temps que T35 — c'est le même sujet.                                                                                                                                                                                                                | Moyenne               |
| C14 | **Verrouillage de ligne pour la réservation**                            | §5.5 exige `SELECT … FOR UPDATE` sur la session. Prisma n'expose pas le verrouillage de ligne.                                                                                                                                                                                                                                                                                             | Requête SQL brute dans une transaction Prisma, comme déjà fait pour la courbe du tableau de bord. Exception assumée et localisée à la réservation, avec le test de concurrence exigé par le brief (20 requêtes simultanées sur 1 place).                                                                                                                                                                                                                                                                                                     | Basse (technique)     |

Ces points n'empêchent pas de démarrer le Lot 0 : aucun ne remet en cause l'architecture. C6 et C7 sont les seuls susceptibles de retarder la **mise en production** réelle du Lot 1 (le développement, lui, n'est pas bloqué).

---

## 1. Hypothèses reconduites telles quelles (§13 du brief)

- Validation automatique : `PERSONNEL_ANSD`, `PRESTATAIRE`, `PARTICIPANT_NATIONAL` ; manuelle pour les autres catégories.
- Capacité par défaut d'un panel : 80 ; quota VIP : 10 ; liste d'attente activée.
- Badge : format CR80 paysage.
- Stack par défaut = Next.js/Docker (§3.1) ; bascule vers l'alternative Vite/Express uniquement sur instruction explicite ultérieure.

---

## 2. Lot 0 — Socle (échéance cible : 8 septembre 2026)

### 0.1 Initialisation du monorepo

- [x] `create-next-app` (Next.js 15.5.25, App Router, TypeScript strict, Tailwind v4) à la racine du dépôt.
- [x] Arborescence cible conforme à §3.2 (`src/app` par groupes de routes, `src/modules/*`, `src/lib`, `src/components/ui`, `storage/`, `docker/`, `messages/`).
- [x] ESLint (fourni par `create-next-app`, `pnpm lint` vert).
- [x] Prettier + Husky + lint-staged (`.prettierrc.json`, hook `pre-commit` → `lint-staged`).
- [x] Tokens couleur du template repris dans `src/app/globals.css` via `@theme inline` (Tailwind v4 est _CSS-first_ : pas de `tailwind.config.ts` séparé) + polices Sora/Inter via `next/font` (`src/app/layout.tsx`).
- [x] `globals.css` : variables `:root` / `[data-theme="dark"]` reprises fidèlement (la règle sombre n'est volontairement pas restreinte à `:root` pour pouvoir forcer un sous-arbre en sombre — cf. scanner, 0.6).

> Note d'implémentation : Prisma 7 a changé la configuration de connexion (l'URL ne se met plus dans `datasource.url` du schéma). Le projet utilise `prisma.config.ts` (chargement de `.env` explicite) + l'adaptateur `@prisma/adapter-mariadb` (compatible MySQL) pour `PrismaClient`, cf. `src/lib/db.ts`. Prisma est épinglé en `7.10.0` (dernière version stable) : la 8 n'était disponible qu'en release candidate au moment de l'initialisation.

### 0.2 Base de données & Prisma — ✅ complété

- [x] `schema.prisma` : ensemble des entités du §4 (Edition, User, Role/Permission, ParticipantCategory, Participant, Invitation, Delegation, Badge, Zone, CategoryZone, ParticipantZoneOverride, Checkpoint, ScanLog, Room, Session, Speaker, SessionSpeaker, SessionRegistration, SponsorLevel, Sponsor, Contribution, Document, Post, ContentBlock, NotificationTemplate, NotificationLog, MagicLink, AuditLog, Job, Setting).
- [x] Tous les champs `editionId`, timestamps `createdAt/updatedAt`, `deletedAt` (Participant, Session, Speaker, Sponsor).
- [x] Index listés en fin de §4 (`Participant(editionId,status)`, etc.).
- [x] Première migration appliquée (`20260902091756_init`) contre MySQL 8 (conteneur Docker de développement, port hôte 3308 depuis un redémarrage de Docker Desktop — 3306 occupé par un MySQL natif de la machine, 3307 par le conteneur d'un autre projet ; cf. note ci-dessous sur la perte du volume anonyme lors de ce redémarrage).
- [x] `prisma/seed.ts` : 1 édition FID-2026, 8 rôles/permissions (§12), 1 super admin `[DEMO]`, 11 catégories de participants (autoConfirm selon hypothèses §13), 7 zones + matrice catégorie×zone (56 entrées), 7 niveaux de sponsors, 7 modèles de notification (clés Lot 1). Idempotent, vérifié par double exécution. Le volume de démonstration volumineux (300 participants `[DEMO]`, 25 intervenants, sessions) reste complété en fin de Lot 1 au fil de l'implémentation des modules concernés — cf. T-nouveau ci-dessous.
- [x] `src/lib/permissions.ts` : catalogue central des permissions + `DEFAULT_ROLE_PERMISSIONS`, couvert par un test Vitest (`permissions.test.ts`).
- [x] Vérifié : `pnpm lint && pnpm typecheck && pnpm test && pnpm build` tous verts.

### 0.3 Authentification BackOffice + RBAC + 2FA — ✅ complété

- [x] Auth.js v5 (bêta, cf. décision C8) credentials, sessions JWT httpOnly (`src/auth.ts`,
      `src/auth.config.ts` compatible Edge pour le middleware, `src/middleware.ts` protège `/admin/*`).
- [x] Hachage `argon2id`, verrouillage 5 échecs / 15 min (`src/modules/auth/service.ts`), 5 tests
      Vitest d'intégration (échec, verrouillage, réinitialisation du compteur, TOTP requis/invalide/valide).
- [x] TOTP 2FA obligatoire pour `SUPER_ADMIN`/`ADMIN_FORUM` : enrôlement forcé à la première
      connexion (`/admin/2fa/enroll`, QR + confirmation) via le callback `authorized` du middleware ;
      reconnexion requise après activation (la session JWT en cours ne peut pas être rafraîchie
      à la volée avec cette version bêta — cf. commentaire dans `enroll/actions.ts`).
- [x] RBAC déclaratif `can(session, "participants.export")` (`src/lib/rbac.ts`), catalogue de
      permissions centralisé (`src/lib/permissions.ts`, déjà posé en 0.2).
- [x] Compte de démo Super Administrateur créé par le seed. Vérifié : le middleware redirige
      bien `/admin` non authentifié vers `/connexion` (testé en HTTP direct contre l'image
      Docker de production). Le parcours interactif complet (saisie du formulaire → enrôlement
      2FA → reconnexion) suit un mécanisme standard d'Auth.js v5 (Server Actions) mais n'a **pas**
      été rejoué dans un vrai navigateur — aucun outil de navigateur/E2E n'est disponible dans
      cet environnement pour ce faire, et Playwright est explicitement un outil de Lot 1 dans le
      brief. À vérifier manuellement dès que possible (cf. TODO T14).
- [ ] Politique de mot de passe (12+ caractères) : non appliquée à la création/changement de mot
      de passe car aucun écran de gestion des utilisateurs n'existe encore (Lot 1, `users.manage`) ;
      à appliquer à ce moment-là plutôt que d'écrire une validation sans écran pour l'exercer.

### 0.4 Journal d'audit — ✅ complété

- [x] `src/lib/audit.ts` : `audit.log({ actorType, actorUserId?, actorParticipantId?, action, entity, entityId, before, after, ip, userAgent })`.
- [x] Table `AuditLog` append-only (pas d'update/delete exposés côté service).
- [x] Test d'intégration (`audit.test.ts`, écriture réelle en base + vérification before/after).
- [ ] Vérification que chaque service d'écriture du Lot 1 appelle bien ce helper — à faire module par module au fil de leur implémentation (le contrat est posé, rien à appeler pour l'instant : aucun module métier écrivant en base n'existe encore).

### 0.5 Internationalisation — ✅ complété

- [x] `next-intl` opérationnel **sans préfixe d'URL** (décision : les routes du §3.2 ne montrent aucun segment `[locale]`, donc pas de i18n routing — la langue est portée par un cookie `NEXT_LOCALE`, initialisé depuis `Accept-Language` à la première visite, cf. `src/i18n/`).
- [x] `messages/fr.json` / `messages/en.json` : navigation, thème, sélecteur de langue, messages communs — couvre tout ce qui existe à ce stade (chrome + pages placeholder).
- [x] Vérifié bout en bout : bascule FR/EN par cookie testée en HTTP direct (`curl -H "Cookie: NEXT_LOCALE=en"`).
- [ ] Convention `*Fr` / `*En` avec repli FR si EN vide, pour le **contenu éditorial** (`ContentBlock`, `Post`, etc.) — non applicable tant qu'aucun module n'écrit ce contenu ; le repli sera testé avec le module CMS (Lot 1, 3.2).

### 0.6 Layouts publics et admin — ✅ complété (chrome ; contenu réel = Lot 1/2)

- [x] Layout public (`PublicShell` : ticker + header/nav sticky + footer), sélecteur de thème (`data-theme`, cookie serveur anti-flash — vérifié via `curl -H "Cookie: forum-theme=dark"`), sélecteur FR/EN, menu mobile.
- [x] Layout BackOffice (`AdminSidebar` : groupes de navigation par domaine conformes à `.bo` du template) — bloc « who » en placeholder (`TODO(0.3)`), à brancher sur la vraie session juste après.
- [x] Layout scanner (`[data-theme="dark"]` forcé sur un sous-arbre, indépendant du thème global) — coquille vide, contenu en Lot 2.
- [x] Page d'accueil, page admin et 12 autres pages placeholder (une par lien de nav) « vides » (composant `ComingSoon` partagé) — évite les liens morts en attendant le contenu réel du Lot 1/2. `pnpm build` génère les 14 routes sans erreur.

### 0.7 Files/jobs (abstraction, posée tôt car structurante pour le Lot 1) — ✅ complété

- [x] Interface `JobQueue` (`enqueue`, `process`, idempotence par clé) — `src/lib/queue/types.ts`.
- [x] Implémentation `BullMqJobQueue` (BullMQ + Redis, conteneur Docker de dev sur le port hôte 6380).
- [x] Implémentation de repli `DbJobQueue` (table `Job` + `runPendingJobs()` à appeler par un cron externe) — a nécessité l'ajout d'un champ `idempotencyKey` non listé au §4 mais requis par l'exigence d'idempotence du §3.3 (migration `job_idempotency_key`).
- [x] Sélection automatique : `BullMqJobQueue` si `REDIS_URL` est défini, sinon `DbJobQueue` (`src/lib/queue/index.ts`).
- [x] `lib/mail.ts` (Nodemailer, bas niveau), `lib/storage/` (interface `FileStorage` + `LocalFileStorage`), `lib/qr.ts` (`qrcode`, pleinement fonctionnels).
- [x] `lib/pdf.ts` : interface posée, implémentation Puppeteer **volontairement différée** au module badges (Lot 1, 3.6) plutôt que d'installer Chromium (~300 Mo) avant d'avoir quoi que ce soit pour l'exercer — cf. TODO T11.

### 0.8 CI/CD et Docker — ✅ complété

- [x] GitHub Actions (`.github/workflows/ci.yml`) : install, prisma generate + migrate deploy
      (service MySQL éphémère), lint, format:check, typecheck, test, build sur chaque PR/push main.
- [x] `Dockerfile` multi-stage (`deps` → `builder` → `runner`), build **validé de bout en bout**
      (`docker build`) : les 20 routes se génèrent, l'image tourne, `/api/health` répond `200`
      contre la vraie base MySQL, et `/admin` redirige bien vers `/connexion` quand non
      authentifié. Deux problèmes réels corrigés au passage : absence de `.dockerignore` (le
      `node_modules` Windows de l'hôte écrasait celui, Linux, installé dans l'image) et
      `prisma.config.ts` qui exige `DATABASE_URL` même pour un simple `generate` (résolu par
      des `ARG` factices, jamais persistés dans l'image finale).
- [x] `docker-compose.yml` (dev) : app (mode `pnpm dev`), mysql, redis, mailpit, minio
      (profil `storage` optionnel) — cf. décision C5. Non re-testé via `docker compose up`
      lui-même (le conteneur `app` en mode dev n'a pas été relancé après validation de l'image
      de prod) ; le comportement de chaque service pris isolément a néanmoins été validé.
- [x] `docker-compose.prod.yml` : app (image `runner`), mysql, redis, nginx + certbot
      (`docker/nginx.conf`, domaine `forum2026.ansd.sn` — décision C6, arrêtée le
      22 septembre 2026).
- [x] `healthcheck` `/api/health` (`src/app/api/health/route.ts`) : vérifie une requête DB réelle.
- [x] `.env.example` commenté (DB, Redis, SMTP, secrets, CAPTCHA, domaine).

**Critère de sortie Lot 0** : les chantiers 0.1 à 0.8 sont tous complets — monorepo, schéma Prisma migré et seedé, auth BackOffice + 2FA + RBAC opérationnels, audit log en place, i18n fonctionnel, layouts public/admin/scanner conformes au template, files/jobs opérationnelles, CI en place, `docker build`/l'image de production démarrent site public + BackOffice avec connexion admin. Réserve : TODO T14 (parcours de connexion non rejoué dans un vrai navigateur) et re-test explicite de `docker compose up` (dev) recommandés avant de considérer le Lot 0 totalement clos — cf. §5.

---

## 3. Lot 1 — Ouverture des inscriptions (échéance cible : 5 octobre 2026)

Ordre recommandé (dépendances) : **1.7 → 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.8 → 1.9**, avec 1.8 (notifications) qui se construit en réalité de façon transverse au fil de 1.2/1.3/1.4/1.5.

### 3.1 Participants & délégations — BackOffice (`modules/participants`) — ✅ complété

- [x] `service.ts` : machine à états unifiée (§2.3), implémentée comme fonctions dédiées par
      opération plutôt qu'une matrice générique (chacune a ses propres effets de bord — audit,
      dates, mise en file de la génération de badge). 10 tests Vitest d'intégration : chemin
      complet REGISTERED→CONFIRMED→BADGED→CHECKED_IN, auto-confirmation par catégorie, inscription
      sur place (CONFIRMED direct), rejets de transitions invalides, e-mail dupliqué.
- [x] CRUD participant (`repository.ts`/`service.ts`/`actions.ts`), validation manuelle
      (`confirmParticipantAction`), décliner/annuler, notes internes, suppression logique.
- [x] Listing BackOffice (`/admin/participants`) : recherche, filtres (statut/catégorie),
      pagination serveur, un seul aller-retour Prisma (`select` ciblé, pas de N+1).
- [x] Délégations : CRUD, désignation du chef (`/admin/delegations`), vue membres avec statuts.
      Inscription groupée par le chef de délégation lui-même : différée à l'espace participant
      (module 3.5, car elle suppose l'authentification participant par lien magique).
- [x] Permissions RBAC appliquées (`participants.read/write/delete`, `delegations.read/write`)
      sur chaque page et Server Action.
- [x] Seed enrichi : 18 participants `[DEMO]` + 2 délégations, créés via le vrai `service.ts`
      (pas de logique dupliquée), statuts variés pour exercer l'UI (cf. T10).
- Bugs réels trouvés et corrigés en construisant ce module (au-delà du module lui-même) :
  BullMQ rejette un `jobId` contenant `:` (`src/lib/queue/bullmq-queue.ts` sanitize désormais
  l'idempotencyKey) ; un script court-lived (`prisma/seed.ts`) qui enqueue un job ne se termine
  jamais sans fermer explicitement la connexion Redis (`JobQueue.close()` ajouté à l'interface).
- Décisions notées en §5 : T15 (`@tanstack/react-table` v9 a renommé son API classique en
  `/legacy`) et T16 (formulaires BackOffice en HTML natif + Server Action plutôt que
  `react-hook-form`, réservé au formulaire public multi-étapes du module 3.4).
- **Vérifié de bout en bout** contre l'image Docker de production (pas seulement `build`) :
  connexion réelle (compte `GESTIONNAIRE_PARTICIPANTS` temporaire, sans 2FA obligatoire),
  `/admin/participants` affiche les 18 participants `[DEMO]` réels avec statuts colorés,
  filtre `?status=DECLINED` isole correctement le seul participant décliné, page de détail
  affiche les bons boutons de transition selon le statut (`CONFIRMED` → seul « Annuler la
  participation » proposé), `/admin/delegations` affiche les 2 délégations seedées.

### 3.2 Site public (`app/(public)`) — ✅ complété (réserves ci-dessous)

- [x] Pages branchées sur de vraies données : Accueil, À propos, Infos pratiques (`ContentBlock`),
      Intervenants (`Speaker`, état vide géré), Sponsors (`Sponsor`/`SponsorLevel`, groupés,
      état vide géré), Actualités + détail (`Post`). Programme/Inscription/Vérifier un badge
      restent des « points d'entrée » `ComingSoon` — cf. décision ci-dessous.
- [x] Accueil : hero avec compte à rebours (`Countdown`, cible = `edition.startDate`, Dakar = UTC
      donc pas de conversion de fuseau), bloc « live » avec chiffres réels mis en cache 5 min
      (`src/lib/stats.ts`, `unstable_cache`) — participants confirmés, pays, mini-histogramme
      des 6 premiers pays —, aperçu des 3 dernières actualités publiées, CTA.
- [x] CMS léger (`modules/content`) : `ContentBlock` (10 zones éditoriales, texte brut — pas de
      HTML/éditeur riche pour ce premier passage, volontairement : évite tout risque XSS sans
      sanitisation dédiée, cf. décision ci-dessous) + `Post`/Actualités (CRUD admin, publication).
      Repli FR→EN testé unitairement (`resolveLocaleValue`, 4 tests).
- [x] i18n FR/EN fonctionnel sur les pages construites (contenu, dates `Intl.DateTimeFormat`,
      vérifié en HTTP direct avec `Cookie: NEXT_LOCALE=en` contre l'image de production).
- [x] Open Graph : `metadataBase` + template de titre au niveau racine, `generateMetadata` par
      page (y compris les placeholders restants). Sitemap (`src/app/sitemap.ts`).
- Décisions prises, à valider : **programme/inscription/vérifier restent des `ComingSoon`**
  malgré leur mention en §3.2, car ce sont des points d'entrée vers des modules pas encore
  construits (Programme = Lot 2 hors périmètre, cf. §6 ; Inscription = module 3.4 ; Vérifier =
  module 3.7) — les construire à moitié maintenant produirait une UI qui ne mène nulle part.
  Éditeur riche minimal → texte brut pour l'instant (cf. ci-dessus) ; historique 10 versions
  de `ContentBlock` non implémenté (pas dans le schéma Prisma du brief, ajout hors scope de ce
  passage) — cf. TODO T17/T18.
- Bug réel trouvé et corrigé en le construisant : `sitemap.ts` était pré-généré au moment du
  `next build` (Next.js le traite comme statique par défaut), donc échouait dans l'image Docker
  faute de vraie base de données à cette étape — corrigé avec `export const dynamic = "force-dynamic"`.
- **Non vérifié** : audit Lighthouse (perf/a11y/SEO ≥ 90) — aucun Chrome/Lighthouse CLI
  disponible dans cet environnement pour le faire tourner réellement (cf. TODO T19).
- **Vérifié de bout en bout** contre l'image Docker de production : accueil (titre/lead/countdown/
  stats réels), sponsors (regroupés par niveau, données réelles), actualités (liste + détail),
  à propos, infos pratiques, sitemap.xml (13 URL), et la bascule EN via cookie direct.

### 3.3 Invitations (`modules/invitations`) — ✅ complété (une réserve)

- [x] Import Excel/CSV en deux temps : prévisualisation (validation ligne à ligne, doublons dans
      le fichier **et** contre les invitations/participants déjà en base, rapport d'erreurs
      détaillé) puis confirmation. Modèle `.xlsx` téléchargeable (`/api/v1/invitations/template`).
      **Test de performance vérifié** : 1000 lignes prévisualisées + importées en un seul
      `createMany`, bien sous les 10 s exigées.
- [x] Création manuelle (`/admin/invitations/nouvelle`), envoi individuel et groupé **toujours
      via `JobQueue`** (jamais synchrone) — handler `invitation.send` qui rend le modèle
      `NotificationTemplate` seedé, envoie via SMTP et trace dans `NotificationLog`.
- [x] Lien personnalisé `/inscription?inv=<token>` : le token est généré et transmis dans
      l'e-mail ; le **pré-remplissage** du formulaire arrivera avec le module 3.4 (le formulaire
      n'existe pas encore) — le clic, lui, est déjà tracé.
- [x] Suivi : pixel d'ouverture (`/api/v1/invitations/[token]/pixel`, GIF 1×1) → `OPENED`,
      clic sur le lien → `CLICKED`, inscription → `REGISTERED`. **Vérifié en HTTP réel** contre
      l'image de production : pixel puis clic font bien évoluer le statut en base.
- [x] Relances filtrées (catégorie/pays) avec limite de 3 (`sendReminders`). A nécessité l'ajout
      d'un champ `country` sur `Invitation` (absent du §4 du brief, mais indispensable pour le
      filtre « pays » exigé au §5.5) — migration `invitation_country`.
- [x] Rapprochement automatique par e-mail branché dans `createParticipant` (module 3.1),
      couvert par un test Vitest dédié.
- [x] Amorce du module 3.8 : `modules/notifications/service.ts` (rendu de modèle + envoi + log),
      volontairement minimal — l'envoi groupé avec filtres et la gestion des modèles en
      BackOffice restent le module 3.8.
- Bug de conception trouvé et corrigé pendant la vérification : le handler de job était
  enregistré à l'import du module, ce qui (1) faisait qu'un script court-lived important ce
  module n'en finissait jamais (worker BullMQ ouvert) et (2) via `instrumentation.ts`, cassait
  le build en tirant BullMQ (`child_process`, `net`) dans le bundle **Edge** du middleware.
  Résolu par un enregistrement paresseux, côté Node uniquement, à la première mise en file.
- **Sécurité — tranché** : `xlsx` est installé depuis le **registre officiel SheetJS**
  (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, épinglé avec vérification d'intégrité
  dans `pnpm-lock.yaml`) et non depuis npm public, dont la dernière version (0.18.5) porte un
  ReDoS non corrigé. Vérifié que le build Docker atteint bien ce registre. Défense en profondeur
  conservée : import réservé aux admins authentifiés, plafond 5 Mo, parsing serveur uniquement.

### 3.4 Inscription en ligne (`modules/participants` + formulaire) — ✅ complété (deux réserves)

- [x] Formulaire multi-étapes (Identité → Profession → Participation → Logistique → Consentements)
      avec schémas `zod` **réellement partagés** : la validation pas à pas côté client utilise les
      mêmes schémas d'étape que la validation serveur (`registration-schema.ts`).
- [x] Champs conditionnels : l'étape Logistique n'apparaît que si la catégorie choisie porte
      `requiresLogistics` (mise à jour en direct au changement de catégorie).
- [x] Brouillon persistant en **localStorage**, restauré au montage, effacé après succès.
      Brouillon **serveur** volontairement non implémenté — cf. réserve ci-dessous.
- [x] `CaptchaProvider` (`src/lib/captcha.ts`) : Turnstile si les clés sont fournies, sinon
      implémentation neutre (décision C4) ; honeypot (champ `fax` masqué) ; rate limit 5/min/IP
      via `src/lib/rate-limit.ts` (Redis quand disponible, repli mémoire) — **testé**.
- [x] Doublon d'e-mail → message proposant le lien magique de « Mon espace » plutôt qu'une
      seconde inscription — testé.
- [x] Soumission : `REGISTERED`, ou `CONFIRMED` + badge mis en file si la catégorie auto-confirme ;
      e-mail `registration_received`/`registration_confirmed` mis en file (jamais synchrone).
      Consentements horodatés (`consentAt`). 7 tests d'intégration.
- [x] Lien d'invitation : `/inscription?inv=<token>` pré-remplit identité/e-mail, **verrouille**
      la catégorie de l'invitation (qui prime sur celle du formulaire — testé), marque le clic et
      passe l'invitation en `REGISTERED` à la soumission. **Vérifié en HTTP réel** contre l'image
      de production.
- [x] Brique réutilisable posée pour la suite : `enqueueNotification` (`modules/notifications/jobs.ts`),
      qui servira aussi aux modules 3.5 à 3.8.
- **Réserve 1 — brouillon serveur** : le brief demande aussi une sauvegarde serveur « dès qu'un
  e-mail est saisi ». Non fait ici volontairement : cela impliquerait de créer une ligne
  `Participant` (ou une table dédiée) depuis un formulaire public anonyme, donc une surface de
  spam à protéger. À arbitrer (cf. T23) — le localStorage couvre déjà la reprise sur le même
  appareil, et la reprise multi-appareils viendra naturellement avec le lien magique (3.5).
- **Réserve 2 — photo** : champ photo facultatif + recadrage carré non implémentés (cf. T24) ;
  ils seront branchés avec le module badges (3.6), où le stockage de fichiers est réellement
  exercé, plutôt que d'ajouter un upload sans consommateur.
- **Non vérifié** : le test Playwright bout-en-bout demandé par le brief (inscription → e-mail
  Mailpit → lien magique → badge) reste impossible ici (aucun navigateur disponible) et dépend
  de modules non encore construits (3.5, 3.6) — cf. T14/T25.

### 3.5 Espace participant `/mon-espace` (`modules/auth` côté participant) — ✅ complété (deux réserves)

- [x] Flux lien magique : demande → email (validité 30 min) → consommation → **émission du cookie de session** (cf. décision C2) ; code à 6 chiffres en secours. - `modules/auth/magic-link.ts` : jeton de 32 octets aléatoires en base64url, dont seul le
      **SHA-256 est stocké** (`MagicLink.tokenHash`) — une fuite de la table ne permet pas de
      rejouer un lien. Usage unique (`usedAt`), expiration 30 min, audit à chaque étape. - Pas d'énumération d'e-mails : un e-mail inconnu renvoie `SENT` sans créer de ligne
      (test dédié). - `modules/auth/participant-session.ts` : décision **C2** appliquée — cookie JWT `HS256`
      httpOnly signé avec `MAGIC_LINK_SECRET`, 30 jours, pas de table de sessions. - Consommation du lien : **Route Handler** `(participant)/mon-espace/lien/[token]/route.ts`
      et non une page — seuls un Route Handler ou une Server Action peuvent poser un cookie.
      Redirection **relative** (303) : `NextResponse.redirect(new URL(…, request.url))`
      reconstruisait l'URL depuis le `Host` interne du conteneur (`0.0.0.0:3000`) et envoyait
      l'utilisateur sur un hôte injoignable — constaté puis corrigé lors de la vérification.
- [x] Rate limit `/auth/magic-link` 3/min/email. - **Ajout au-delà du brief** : la vérification du code à 6 chiffres est elle aussi limitée
      (5/min/email). Sans cela, le repli — un million de combinaisons — serait cassable par
      force brute alors que la demande de lien, elle, était protégée.
- [x] Vue : infos (modifiables jusqu'à J-3), statut, badge (PDF/PNG), sessions réservées (liste simple, réservation avancée en Lot 2), membres de délégation si chef. - `modules/participants/my-space-service.ts` : `mySpaceInputSchema` est une **liste blanche**
      (ni catégorie, ni statut, ni consentements — le participant ne peut pas s'auto-promouvoir) ;
      `canEditNow`/`editDeadline` calculent J-3 à partir de `Edition.startDate`, testés
      unitairement, et la règle est **revérifiée côté serveur** (le formulaire désactivé ne
      suffit pas). - Badge : la vue affiche les liens PDF/PNG dès que `Badge.pdfPath` existe ; la génération
      elle-même est le module 3.6, donc l'état affiché est aujourd'hui « en attente ». - Sessions : liste simple (aucune inscription en base tant que le Lot 2 n'ouvre pas la
      réservation) ; bloc délégation affiché uniquement au chef (`headParticipantId`), vérifié
      en conditions réelles.
- [x] Demande de suppression de compte (droit RGPD/loi 2008-12) — déclenche un job de traitement, tracé dans `AuditLog`. - `requestAccountDeletion` écrit l'`AuditLog` puis met en file `participant.deletion_request`
      (clé d'idempotence par participant). L'**anonymisation effective n'est pas exécutée ici** :
      elle relève du Lot 3 ; le job attend donc son handler (cf. T26).

**Vérification** (image Docker de production, MySQL et Redis réels) : page déconnectée (200,
formulaire de demande) ; consommation du lien → 303 + `Set-Cookie` httpOnly/Secure/SameSite=Lax ;
seconde consommation du même jeton → `?erreur=lien` (usage unique confirmé côté HTTP) ; page
connectée rendue avec le vrai participant (nom, `publicId`, statut « Confirmé », catégorie,
organisation et fonction pré-remplies, échéance « 20 novembre 2026 (J-3) » calculée depuis
l'édition) ; bloc délégation affiché pour un chef de délégation et absent sinon. 10 tests
supplémentaires (44 au total), typecheck, lint et format au vert.

**Réserves** : les trois Server Actions du module (`requestMagicLinkAction`, `updateMyInfoAction`,
`requestDeletionAction`) n'ont pas pu être rejouées hors navigateur — le protocole de soumission
React ne se reproduit pas fidèlement en `curl` (cf. T27) ; leur logique métier est en revanche
couverte par les tests d'intégration. La réception réelle de l'e-mail (Mailpit) reste à vérifier
avec le module 3.8.

### 3.6 Badges et QR (`modules/badges`) — ✅ complété (deux réserves)

- [x] Génération du token : `publicId + "." + base32(HMAC-SHA256(secret, publicId + version))[0:16]` ; secret en variable d'environnement, versionnable. Test unitaire signature/vérification. - `modules/badges/token.ts` : base32 RFC 4648 (sans remplissage), comparaison en **temps
      constant** (`timingSafeEqual`). 10 tests unitaires : déterminisme, changement de signature
      à chaque version et d'un participant à l'autre, refus d'une signature falsifiée ou d'un
      `publicId` substitué, tolérance à la casse et aux espaces (saisie manuelle en secours). - Seule l'**empreinte SHA-256** du token est stockée (`Badge.qrToken`). Une fuite de la table
      ne permet ni de fabriquer un QR (il faut le secret) ni d'en rejouer un existant.
- [x] `publicId` non séquentiel (ex. `FID26-7K3M2P`), généré à la création du participant.
      — déjà en place depuis le module 3.1 (`generateUniquePublicId`).
- [x] Gabarit HTML/CSS par catégorie (reprendre `.badge` du template : bandeau couleur, mention catégorie, photo, nom, fonction, organisation, pays, `publicId`, QR). - `modules/badges/template.ts` : HTML **autonome** (CSS en ligne, QR et photo en `data:` URI,
      aucune ressource distante) — condition nécessaire pour que le rendu n'attende aucun réseau. - La couleur vient de `ParticipantCategory.color` (bandeau dégradé + pastille + contour de
      la photo) : c'est là le « gabarit par catégorie », sans multiplier les fichiers. - Photo prise en charge via `Participant.photoPath`, repli sur les initiales si absente ou
      illisible. Le **téléversement** de la photo reste à faire (T24).
- [x] Génération asynchrone (job) : rendu → PNG 1200px + PDF (CR80 par défaut) → stockage via `FileStorage` → email `badge_ready`. - `modules/badges/jobs.ts` : le job `badge.generate`, mis en file depuis le module 3.1, a
      enfin son handler. Le service y est chargé par **import dynamique** : un import statique
      créerait un cycle (`badges/service` → `participants/service` → `badges/jobs`). - `lib/pdf.ts` est réellement implémenté (**TODO T11 levé**) : `puppeteer-core` + Chromium
      système. Voir « Mise au point du rendu » ci-dessous. - Fichiers écrits sous `badges/<publicId>/v<n>.{pdf,png}` **hors webroot** (brief §7), servis
      par `/api/v1/badges/:id/:format` sous contrôle d'accès : propriétaire (session participant)
      ou BackOffice avec `badges.generate`. Un tiers reçoit **404 et non 403** — répondre
      « interdit » confirmerait l'existence du badge. Badge révoqué : 410 pour le participant,
      consultable par le BackOffice (historique).
- [x] BackOffice : génération unitaire, régénération, révocation + réémission (version+1, ancien QR invalidé), compteur d'impressions. - `BadgePanel` sur la fiche participant, chaque action derrière sa permission
      (`badges.generate` / `badges.revoke` / `badges.print`). - Régénération à version constante (cas « la photo a changé ») distincte de la réémission
      (version+1, ancien QR invalidé). Une régénération demandée sur un badge révoqué est
      **refusée avec un message explicite** renvoyant vers la réémission. - **Non fait, priorisé en Lot 2 comme le brief l'autorise** : impression physique complète
      et export ZIP par délégation.
- [x] Test : génération de 500 badges en lot < 5 min ; QR révoqué scanné → état `REVOKED`. - Débit **mesuré à 319–395 ms/badge** (PDF + PNG, 4 onglets) → 500 badges en **2,7 à 3,3 min**,
      pour un budget de 600 ms/badge (5 min). - La mesure vit dans `pnpm bench:badges`, **volontairement hors de la suite de tests** :
      Vitest exécute les fichiers en parallèle, si bien qu'une assertion de temps mesure surtout
      la contention du moment — le même lot donnait 201 ms/badge isolé et 778 ms/badge au milieu
      des autres fichiers. Un seuil dans ces conditions n'aurait rien signifié. La suite garde
      les tests de **correction** (PDF au format CR80, PNG à 1200 px). - `service.test.ts` : 6 tests d'intégration, dont « QR révoqué → `REVOKED` » et « la
      réémission invalide l'ancien QR ». Un badge révoqué renvoie explicitement `REVOKED` et non
      `UNKNOWN` : l'agent de contrôle doit distinguer « badge retiré » de « faux badge ».

**Mise au point du rendu — quatre défauts trouvés et corrigés à la vérification :**

1. **Course à la création du badge.** Le job posé à la confirmation et l'appel explicite créaient
   la même ligne de front → violation de `Badge_qrToken_key`. L'`upsert` de Prisma ne suffit pas
   (sur MySQL il se traduit par un SELECT puis un INSERT). Corrigé par `ensureBadgeRow`, qui
   rattrape la collision et relit la ligne, plus une transition `markBadged` tolérante à
   « quelqu'un l'a déjà fait ». Le test a révélé la course, pas l'inverse.
2. **Blocage du pool d'onglets.** Chromium ne produit de frame que pour l'onglet de premier plan :
   deux captures d'écran concurrentes restaient bloquées jusqu'au `protocolTimeout` (180 s). Le
   PDF, lui, se parallélise sans difficulté (~116 ms/badge sur 4 onglets). Corrigé en amenant la
   page au premier plan et en **sérialisant la seule étape de capture**.
3. **PNG à 204 px au lieu de 1200.** Le gabarit est dimensionné en millimètres : élargir le
   viewport ne l'agrandit pas. Le facteur d'échelle est désormais calculé depuis la boîte
   englobante de l'élément.
4. **Bandeau de couleur absent, puis identifiant coupé.** Dans une colonne flex à hauteur fixe,
   un enfant sans `flex-shrink: 0` est écrasé quand le contenu déborde : le bandeau disparaissait
   du rendu. Après correction, c'est le `publicId` qui sortait de la carte. Mise en page
   restructurée avec un **pied de carte à hauteur fixe** (pastille, QR, identifiant) et
   `overflow: hidden` en garde-fou.

**Vérification** (image Docker de production) : Chromium 152 et polices présents dans l'image,
rendu d'un badge accentué exécuté **dans le conteneur** (PDF 18 ko, PNG 1200 px) ; téléchargement
`/api/v1/badges/:id/pdf|png` → **404 en anonyme**, 200 avec la session participant (60 ko de PDF,
118 ko de PNG, en-têtes corrects) ; badge relu visuellement à chaque itération jusqu'à obtenir la
carte complète (bandeau, initiales, nom, fonction, organisation · pays, pastille de catégorie, QR,
identifiant). 61 tests au vert sur deux passes, typecheck, lint et format OK.

**Coût** : l'image de production passe à **1,48 Go** (paquet système `chromium` + polices). C'est
le prix du rendu fidèle au gabarit exigé par le brief ; une alternative sans navigateur
(`pdf-lib`) supprimerait ce poids mais imposerait de réécrire le badge en primitives PDF, sans
réutiliser le CSS du template.

**Réserves** : le QR encode `${PUBLIC_BASE_URL}/v/:token`, dont la page est le module 3.7 —
d'ici là, scanner un badge mène à une 404 (cf. T28). La suite de tests fixe
`PDF_RENDER_CONCURRENCY=1` : le pool à 4 onglets affamait les fichiers voisins (argon2 notamment)
au point de les faire expirer ; la production garde 4.

### 3.7 Vérification publique du badge (`app/(public)/verifier`, `app/v/[token]`) — ✅ complété

- [x] Endpoint `GET /api/v1/badges/verify/:token`, rate limit 30/min/IP. - Répond **200 même pour un badge inconnu ou révoqué** : ce n'est pas une erreur HTTP mais
      le résultat du contrôle, que le scanner du Lot 2 lira dans `status`. Seul le dépassement
      de quota renvoie 429, avec un en-tête `Retry-After`.
- [x] Page publique : prénom, nom, organisation, pays, catégorie, validité — **jamais** email/téléphone/photo (§2.11). - La sélection Prisma ne charge tout simplement pas les champs interdits : la contrainte est
      appliquée à la source, pas à l'affichage. Un test vérifie que la réponse sérialisée ne
      contient ni e-mail, ni `phone`, ni `photoPath`, et que la liste des clés exposées est
      exactement celle attendue. - `app/(public)/v/[token]` est la cible des QR imprimés (**TODO T28 levé**) : l'appareil
      photo d'un téléphone ouvre directement le résultat, rendu côté serveur, sans JavaScript.
- [x] Saisie manuelle de l'identifiant en secours (reprise du composant `.verify` du template). - Formulaire en **GET** plutôt qu'en Server Action : le résultat devient une URL partageable
      et rejouable, et la page fonctionne sans JavaScript — utile sur un poste d'accueil au
      réseau capricieux.

**Décision de conception — deux niveaux de preuve.** Le badge n'imprime que le `publicId` ; la
signature n'existe que dans le QR. La saisie manuelle ne peut donc porter que l'identifiant, et
**ne prouve pas l'authenticité du support** : quiconque recopie un identifiant vu ailleurs
obtiendrait la même réponse. Plutôt que d'afficher la même coche verte dans les deux cas, le
résultat distingue :

| Voie                               | Niveau       | Affichage                                                                                                   |
| ---------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| QR scanné, signature HMAC vérifiée | `SIGNED`     | « Badge valide », pastille verte                                                                            |
| Identifiant saisi (secours)        | `IDENTIFIER` | « Identifiant reconnu », pastille orange + mention explicite que l'authenticité du badge n'est pas vérifiée |

Six états sont distingués, tous vérifiés en conditions réelles : `VALID`, `REVOKED` (avec motif),
`CANCELLED` (participation annulée alors que le badge n'a pas été révoqué — il ne donne aucun
droit d'accès, le dire plutôt que d'afficher « valide »), `NOT_BADGED` (inscription sans badge
émis), `UNKNOWN`, `RATE_LIMITED`.

**Vérification** (image Docker de production) : QR scanné → « Badge valide » + « Signature du QR
code vérifiée » avec les données du participant ; identifiant saisi → « Identifiant reconnu » avec
la réserve d'authenticité ; jeton falsifié → « Badge non reconnu » ; badge révoqué → « Badge
révoqué · Motif : Badge perdu » ; participation annulée → « Participation annulée » ; identifiant
sans badge → « Aucun badge émis ». Limite de débit mesurée : **exactement 30 réponses 200 puis
429 avec `Retry-After: 54`**. API JSON conforme, sans donnée interdite. 8 tests d'intégration
supplémentaires (69 au total), typecheck, lint et format au vert.

**Note** : ces tests insèrent les lignes `Badge` directement au lieu de passer par le rendu — la
vérification ne dépend pas du PDF/PNG, et la suite reste ainsi exécutable sans navigateur.

**Navigation publique restructurée** (demande ANSD, à la suite de la mesure ci-dessus). Les sept
entrées à plat devenaient impossibles à loger ; elles sont regroupées par thématique dans
`components/site/nav-items.ts`, source unique partagée par l'en-tête et le menu mobile :

| Entrée                 | Contenu                                                     |
| ---------------------- | ----------------------------------------------------------- |
| Accueil                | `/`                                                         |
| **Le Forum** ▾         | À propos · Programme · Intervenants · Contributions & Actes |
| **Infos & services** ▾ | Infos pratiques · Actualités · Vérifier un badge            |
| Partenaires            | `/sponsors`                                                 |
| Organisation           | `/admin`                                                    |

Effet de bord favorable : `/a-propos`, `/actualites` et `/contributions` existaient **sans figurer
dans aucun menu** (seulement dans le pied de page) — elles sont désormais atteignables depuis
l'en-tête. Le menu déroulant s'ouvre au **clic et non au survol** (un menu au survol est
inatteignable au doigt et pénible au clavier), se ferme à l'Échap en rendant le focus au
déclencheur, au clic extérieur, à la perte de focus et au changement de page. Sur mobile, les
groupes sont **dépliés en sections** plutôt qu'en menus imbriqués : dans un panneau plein écran,
un second niveau à ouvrir n'ajouterait qu'un clic. Comportement vérifié en navigateur
(`aria-expanded` false → true au clic → false à l'Échap, entrées et liens corrects).

**Hors périmètre assumé** : aucune ligne `ScanLog` n'est écrite ici. Ce modèle exige un
`checkpointId` et relève du scanner du Lot 2 ; une vérification publique n'est pas un passage de
contrôle.

### 3.8 Notifications de base (`modules/notifications`) — ✅ complété (une réserve)

- [x] Modèles `NotificationTemplate` couvrant les 7 clés du Lot 1 : `invitation`,
      `invitation_reminder`, `registration_received`, `registration_confirmed`, `badge_ready`,
      `magic_link`, `thank_you`.
- [x] Éditeur de modèles en BackOffice, variables `{{prenom}}`, `{{lien_badge}}`, etc. - Édition FR **et** EN côte à côte, avec **aperçu en direct** calculé sur la saisie en cours
      (et non sur l'enregistré), reproduisant exactement l'interpolation du serveur pour que
      l'aperçu ne mente pas. - Les deux langues restent dans le DOM (masquées par `hidden`) : sans cela, basculer FR→EN
      avant d'enregistrer aurait effacé la langue non affichée. - `undeclaredVariables` signale les variables **utilisées mais non déclarées** : une faute de
      frappe comme `{{prenon}}` partirait sinon telle quelle dans l'e-mail, `interpolate`
      laissant les inconnues intactes (choix délibéré, testé).
- [x] Historique d'envoi par participant (`NotificationLog`), gestion des bounces basique. - Visible sur la fiche participant du BackOffice — de quoi répondre à « je n'ai rien reçu »
      sans fouiller les journaux SMTP — et en synthèse sur `/admin/notifications`. - Rebond : un destinataire présent dans le `rejected` de la réponse SMTP est journalisé
      `BOUNCED` et distingué d'un simple `FAILED` (panne d'envoi).
- [x] Envoi groupé avec filtre + prévisualisation. - **Deux temps obligatoires** : un premier envoi calcule la population et l'affiche pour
      confirmation ; un envoi de masse ne part pas sur un seul clic. - Un job **par destinataire** plutôt qu'un job unique qui boucle : un échec isolé n'interrompt
      pas la campagne, chaque envoi est réessayé indépendamment, et `NotificationLog` garde une
      ligne par participant. Clé d'idempotence portant l'identifiant de campagne.
- [x] `SmsProvider` : interface posée, implémentation `LogSmsProvider` uniquement (pas de SMS réel en Lot 1, conforme §13).

**Correction d'un défaut du squelette initial** : `sendTemplatedEmail` servait **toujours** la
version française, quelle que soit la `locale` du participant, alors que le portail est bilingue et
que les corps anglais sont renseignés depuis le seed. La langue est désormais déduite de
`Participant.locale` (repli sur le français si la version anglaise est vide), et trois tests
verrouillent le comportement.

**Vérification** (image Docker de production, MySQL, Redis et Mailpit réels) :

- Envoi unitaire : le participant `locale=fr` reçoit « Votre badge est disponible », le
  participant `locale=en` reçoit « Your badge is ready » — bogue de langue confirmé corrigé.
  Encodage vérifié sur la source du message (`charset=utf-8`, `quoted-printable`) : accents
  intacts.
- **Envoi groupé piloté dans un vrai navigateur** (connexion 2FA réelle) : prévisualisation
  « 9 destinataire(s) — modèle thank_you », confirmation, puis **9 e-mails effectivement livrés**,
  9 `NotificationLog` en `SENT`, entrée `AuditLog` `notification.bulk_sent` avec le décompte.
- Les trois pages BackOffice répondent 200 avec session, et redirigent vers `/connexion` sans.

**Défaut trouvé et corrigé pendant cette vérification** : après la prévisualisation, le re-rendu
réinitialisait les `<select>` du formulaire ; comme `templateKey` est `required`, la confirmation
échouait la validation HTML et **ne déclenchait plus rien, silencieusement** (`requestSubmit`
n'émettait même pas d'événement `submit`). Seul le pilotage d'un navigateur réel pouvait le
révéler — les tests de service ne touchent pas au formulaire. La confirmation vit désormais dans un
**formulaire distinct** qui rejoue le filtre exact ayant produit le décompte, transporté en champs
cachés : plus robuste, et l'opérateur confirme la population qu'il a effectivement vue, même s'il a
modifié un filtre entre-temps.

**Réserve** : le chemin `BOUNCED` est codé mais n'a pas pu être rejoué — Mailpit accepte tous les
destinataires, et une adresse localement invalide échoue avant le dialogue SMTP (journalisée
`FAILED`, ce qui est correct). Cf. T30.

### 3.9 Tableau de bord v1 (`app/(backoffice)/admin`) — ✅ complété

- [x] KPIs disponibles à ce stade (§13) : inscrits, confirmés, invités, internationaux/nationaux, VIP, médias, badges générés, taux global. - Chaque tuile porte **sa définition** en sous-titre. « Inscrits », « internationaux » ou
      « badges valides » n'ont rien d'évident : un tableau de bord dont les définitions se
      devinent finit par être lu de travers. National / international se lit sur le **pays de
      résidence** (Sénégal ou non), pas sur deux catégories parmi onze — la lecture couvre ainsi
      tous les inscrits.
- [x] Répartition par pays / catégorie / institution. - Huit lignes au plus, la traîne repliée dans « Autres (n) » — un test vérifie que le repli
      **conserve le total**.
- [x] Entonnoir invités → envoyées → inscrits → confirmés → badgés (présences J1-J3 arrivent avec le scanner en Lot 2).
- [x] Courbe d'inscriptions par jour.
- [x] Flux temps réel des scans : hors périmètre Lot 1 — carte présente avec le renvoi explicite au Lot 2.

**Performance** : tout passe par des `groupBy` recoupés en mémoire plutôt que par une vingtaine de
`count()` empilés — sinon le tableau de bord devient le point lent du BackOffice dès quelques
milliers de participants. La courbe par jour est en SQL brut, Prisma ne sachant grouper que sur des
colonnes, jamais sur une expression (`DATE(registeredAt)`).

**Conception des graphiques** (charte dataviz du projet, jetons ajoutés dans `globals.css`) :

- Les indicateurs sont des **tuiles**, pas des graphiques à une barre : le nombre _est_ la
  visualisation.
- Les répartitions (pays, catégorie, institution) sont des catégories **nominales** : une seule
  mesure, donc **une seule couleur** pour toutes les barres. Les teinter selon leur valeur
  doublerait l'encodage — la longueur dit déjà la grandeur.
- L'entonnoir est en **barres horizontales, pas en trapèze** : le trapèze encode la même grandeur
  deux fois (largeur et pente) et écrase les petites étapes. Les étapes étant ordonnées, elles
  portent une **rampe ordinale d'une seule teinte**.
- Les rampes sont **vérifiées par outil, pas à l'œil** — et l'outil a rejeté mes deux premières :
  en thème clair le pas le plus pâle tombait à 1,73:1 sur le blanc (plancher 2:1), en thème sombre
  deux pas voisins étaient trop proches (ΔL 0,058 < 0,06). Les rampes retenues passent les quatre
  contrôles dans les deux thèmes, **chacune calculée pour sa propre surface** — le thème sombre
  n'est pas une inversion automatique du clair. À noter au passage : le vert ANSD (`#3dbb6e`) ne
  tient que 2,46:1 sur fond blanc, il est donc inutilisable comme couleur de marque en thème clair.
- La courbe est à série unique : **pas de légende** (le titre dit ce qui est tracé), survol avec
  repère et infobulle, valeur libellée au seul point d'extrémité — un nombre sur chaque point ne se
  lit plus —, grille en filets pleins, et **vue tableau** dépliable pour ne pas réserver
  l'information à la lecture graphique.

**Deux défauts corrigés en cours de route :**

1. **L'entonnoir mélangeait deux populations.** Les deux premières étapes comptaient des
   invitations, les trois suivantes des participants — inscriptions spontanées comprises. Avec le
   jeu de démonstration, « Inscrits » (16) dépassait donc « Envoyées » (0), et le taux de passage
   affiché aurait dépassé 100 %. Un test d'invariant (**monotonie décroissante**) l'a fait
   apparaître. L'entonnoir suit désormais la seule population **invitée**, chaque étape étant un
   sous-ensemble strict de la précédente ; la carte le dit explicitement.
2. **La courbe et la tuile se contredisaient** : 18 contre 16, la courbe comptant aussi les
   participations déclinées ou annulées. Deux chiffres divergents sur un même écran suffisent à
   faire douter de tout le reste. Même filtre de statut des deux côtés.

**Jeu de démonstration complété** : le seed ne créait aucune invitation, l'entonnoir n'avait donc
rien à montrer et restait invérifiable. Treize invitations `[DEMO]` couvrant toutes les étapes
(créée, envoyée, ouverte, cliquée, inscrite) ont été ajoutées, dont quatre rattachées à des
participants existants.

**Vérification** : rendu inspecté en conditions réelles dans les **deux thèmes** et à deux
largeurs, sans débordement horizontal ; 8 tests supplémentaires (87 au total) portant sur les
invariants — entonnoir décroissant, cohérence des indicateurs entre eux (confirmés ≤ inscrits,
badgés ≤ confirmés, nationaux + internationaux = inscrits), répartitions dont la somme égale le
total, courbe ordonnée et sans doublon.

### 3.10 Mise en production — 🟡 partiel (seul le point dépendant de l'ANSD reste ouvert)

- [x] HTTPS, en-têtes de sécurité (CSP, HSTS, X-Frame-Options), cookies `Secure/HttpOnly/SameSite`. - CSP **à nonce** et non à `'unsafe-inline'` : Next injecte ses propres scripts en ligne pour
      l'hydratation, et les autoriser globalement aurait autorisé du même coup n'importe quel
      script injecté — c'est-à-dire vidé la CSP de sa protection principale. Vérifié : sur les
      huit pages publiques testées, **100 % des balises `<script>` portent le nonce** et aucune
      violation n'est signalée. - `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
      plus `Referrer-Policy`, `X-Content-Type-Options` et une `Permissions-Policy` qui refuse
      explicitement caméra, micro, géolocalisation et paiement. - HSTS posé **uniquement en production** : en développement il rendrait `localhost`
      inaccessible en HTTP pour toute la durée du `max-age`.
- [x] `backup.sh` (sauvegarde MySQL quotidienne, rétention 30 j) + cron. - Écriture en fichier temporaire puis renommage : un fichier présent dans le répertoire de
      sauvegarde est toujours un fichier complet. Intégrité vérifiée (`gzip -t` + taille
      plancher) — le premier essai a d'ailleurs échoué bruyamment sur un dump vide, ce qui est
      le comportement recherché. - `--no-tablespaces` : le compte applicatif n'a pas le privilège `PROCESS` (et ne doit pas
      l'avoir) ; sans cette option, mysqldump 8 affiche une erreur à chaque exécution alors que
      le dump est complet — de quoi faire ignorer les vraies erreurs. - `restore.sh` fourni **et exécuté** : restauration dans une base jetable, volumétries
      identiques sur cinq tables. Une sauvegarde jamais restaurée n'est pas une sauvegarde.
- [ ] Variables `SMTP_*` réelles renseignées (cf. C7), domaine réel configuré (cf. C6) — **bloquant tant que l'ANSD n'a pas fourni ces éléments** (T1, T2).
- [x] Vérification des 3 endpoints à rate limit sous charge légère. - `/api/v1/badges/verify/:token` : **60 requêtes simultanées → exactement 30 acceptées et 30
      refusées**, deux essais de suite ; cloisonnement par IP vérifié (une IP saturée n'affecte
      pas ses voisines) ; en-tête `Retry-After` présent. Le compteur Redis tient donc sous
      concurrence, pas seulement en séquentiel. - Inscription (5/min/IP) et lien magique (3/min/e-mail) sont des Server Actions, non
      appelables en HTTP direct : leurs limites sont couvertes par les tests d'intégration.
- [x] Page « Politique de confidentialité » éditable, consentements horodatés vérifiés en base. - `/confidentialite` et `/mentions-legales` **n'existaient pas** (404) et le pied de page
      n'en affichait que le libellé, sans lien. Les deux pages sont créées, adossées à des
      `ContentBlock` donc modifiables en BackOffice — un texte légal figé dans le code finit
      toujours par être périmé. - Les textes sont fournis en **brouillon explicitement marqué** en tête
      (« [BROUILLON — À VALIDER PAR L'ANSD…] ») : ce sont des engagements juridiques, ils ne
      peuvent pas être rédigés à la place du responsable de traitement (cf. T31). - Consentements : vérifié en base qu'ils sont enregistrés et **horodatés dans la fenêtre
      attendue**, et qu'une case non cochée reste bien à `false`.

**Deux régressions introduites par ce chantier, trouvées et corrigées à la vérification :**

1. **`/admin` n'était plus protégé par le middleware.** Poser les en-têtes impose d'envelopper
   `auth()` dans un gestionnaire — ce qui **neutralise le callback `authorized`** d'Auth.js. Le
   BackOffice paraissait protégé (les pages revérifient la session et redirigent) mais ne l'était
   plus au niveau du middleware ; la page d'enrôlement 2FA, seule à ne pas revérifier, répondait
   500 au lieu de rediriger. Le contrôle d'accès est désormais appliqué dans `middleware.ts`, seul
   endroit où il s'exécute réellement, et le callback devenu inopérant a été retiré plutôt que
   laissé en place à faire illusion.
2. **Plus aucune connexion possible** (`MissingCSRF`) : faire passer le middleware d'Auth.js sur
   ses propres routes `/api/auth/*` cassait la vérification de son jeton CSRF. Ces routes sont
   exclues du `matcher` — elles ne renvoient que du JSON et des redirections.

**Défaut antérieur corrigé au passage** : l'accueil déclenchait une erreur d'hydratation React
(#418) à chaque chargement — le compte à rebours calculait l'heure au rendu serveur puis à nouveau
au rendu client, et les secondes diffèrent forcément.

**Ajout** : `pnpm create:admin <email> <mot-de-passe> [RÔLE]` pour amorcer le premier
administrateur en production. Le seed ne crée qu'un compte de démonstration, aux identifiants
publiés dans le README, qui n'a rien à faire sur un serveur réel.

**Critère de sortie Lot 1** : inscriptions ouvertes en production, chemin complet inscription → confirmation → badge fonctionnel, BackOffice participants/invitations/délégations opérationnel, notifications de base en file (jamais synchrones), aucune donnée personnelle exposée hors du strict nécessaire sur les pages publiques.

---

## 4. Lot 2 — Programme & jour J (échéance cible : 2 novembre 2026)

**Critère de sortie (brief §14)** : répétition générale avec 50 badges et 3 points de contrôle.
Ce n'est pas un jalon de code : c'est un **exercice à organiser**, avec des badges imprimés, des
appareils réels et des agents. À caler dans le calendrier dès maintenant.

**Ordre retenu — par le risque, non par le confort.** Le scanner passe en premier bien qu'il soit
le neuvième dans l'énumération du brief : c'est le seul chantier qui doit fonctionner **sans
réseau, en quelques centaines de millisecondes, devant une file d'attente**, et le seul dont
l'échec le jour J n'a aucune solution de repli. Le programme, lui, se rattrape jusqu'à la veille.
Le modèle de données est déjà en place (`Session`, `SessionRegistration`, `Speaker`,
`SessionSpeaker`, `Room`, `Zone`, `CategoryZone`, `Checkpoint`, `ScanLog`,
`ParticipantZoneOverride`) : aucun changement de schéma n'est attendu, sauf pour C12.

### 4.1 Zones d'accès et matrice (`modules/access`) — **fait**

- [x] Matrice `Catégorie × Zone` éditable en BackOffice (§2.6), à `/admin/zones`, avec exceptions individuelles (`ParticipantZoneOverride`, motif **obligatoire** et auteur tracés).
- [x] Points de contrôle : CRUD, rattachement à une zone, libellé d'appareil.
- [x] Fonction de décision `evaluerAcces()` — **pure et testée unitairement**, sans accès réseau.

Trois choix qui ne vont pas de soi :

1. **`decision.ts` n'importe rien du serveur.** Le scanner hors ligne (4.2) exécutera ce
   fichier dans le navigateur, sur les données de son manifeste, pendant que le serveur
   l'exécutera sur celles de la base : c'est le même code des deux côtés, sans quoi une
   divergence de règle ne se verrait qu'au premier refus injustifié, devant une file
   d'attente. Les types Prisma y sont importés en `import type` — effacé à la compilation,
   donc aucun client Prisma dans le bundle, mais l'énumération `ScanResult` reste couplée
   à la base : si elle change, le fichier cesse de compiler.
2. **L'ordre des contrôles est significatif.** Un badge révoqué s'annonce comme révoqué
   même s'il est présenté à une zone qui lui serait de toute façon interdite : dire
   « mauvaise salle » laisserait repartir la personne avec un badge révoqué en poche. Un
   test verrouille cet ordre, et un autre vérifie qu'aucune combinaison ne peut produire
   un verdict vert avec un résultat autre que `OK`.
3. **La matrice s'enregistre en bloc, et la boucle est pilotée par la base.** Le formulaire
   ne fait que répondre « oui » ou « non » à des cases que le serveur a lui-même posées :
   une clé fabriquée à la main dans la requête ne peut donc pas ouvrir une paire qui
   n'existe pas dans cette édition (test dédié). L'audit reçoit une entrée par
   enregistrement, pas une par case — soixante-dix lignes de journal pour une case décochée
   rendraient illisible le jour où il faudra comprendre qui a ouvert l'espace VIP.

Deux garde-fous côté suppression : une zone portant des points de contrôle n'est pas
supprimable (la contrainte l'interdirait de toute façon, mais avec un message illisible),
et un point qui a déjà scanné se désactive au lieu de se supprimer — ses scans sont des
faits de présence.

**Migration** `20260904235101_access_decision`, additive : `ParticipantCategory.alertOnScan`
(catégorie à accueillir, cf. T36) et `ScanResult.DENIED_STATUS`. Cette dernière valeur
manquait : sans elle, un participant annulé aurait été journalisé comme « badge révoqué »,
ce qui aurait faussé les rapports du jour J. Le §4 annonçait « aucun changement de schéma
attendu » — c'était inexact, et il valait mieux le corriger que s'y tenir.

**Vérification** : 23 tests unitaires sur la décision pure, 5 tests d'intégration sur la
résolution des droits (dont l'accord d'une exception qui n'élargit **que** son
bénéficiaire), 3 tests de bout en bout sur l'écran réel, dans l'image Docker de production.

**Pourquoi en premier** : le scanner ne peut pas être écrit avant de savoir ce qu'il autorise.

### 4.2 PWA Scanner hors ligne (`app/(scanner)`) — **fait**

- [x] Route `/scan` installable (webmanifest + service worker), plein écran, caméra arrière, sélection du point de contrôle, session BackOffice et permission `scan.use`.
- [x] **Manifeste hors ligne** : empreintes SHA-256 des badges + données minimales d'affichage ; photos hors manifeste, à la demande, jamais bloquantes.
- [x] Vérification locale : empreinte du QR lu, zone autorisée, badge non révoqué, statut du participant.
- [x] File de scans (`clientScanId` UUID) en IndexedDB, synchronisée au retour du réseau ; indicateur en ligne/hors ligne et nombre de scans en attente.
- [x] Résultat plein écran **vert / orange / rouge** (§2.5) avec photo, nom, catégorie, son et vibration.
- [x] Anti-double-scan (même badge, même point, < 2 min), **évalué hors ligne** (cf. T40).
- [x] Recherche manuelle (nom, organisation, publicId) en secours si le QR est illisible.

**Ce qui a été tranché en codant** :

1. **C9 est résolu sans clé côté client.** Le manifeste transporte l'empreinte SHA-256 du
   token — celle déjà stockée en base (`Badge.qrToken`) — et le scanner hache le QR lu pour
   la chercher. Vérification hors ligne complète, aucun secret hors du serveur, forgerie
   impossible. Un test unitaire compare le calcul du navigateur à celui du serveur : s'ils
   divergeaient, **aucun** badge ne serait reconnu hors ligne et rien dans le typage ne le
   signalerait. Reste à faire arbitrer par l'ANSD si elle préfère une signature Ed25519.
2. **C10 : pas de chiffrement décoratif.** Chiffrer le manifeste supposerait une clé
   embarquée dans l'application, donc lisible. À dire tel quel à l'ANSD plutôt que de livrer
   une protection qui n'en est pas.
3. **C11 : manifeste entier plutôt qu'incrémental.** Une fois les photos sorties, 1 500
   participants tiennent dans quelques dizaines de kilo-octets compressés ; un ETag rend un
   manifeste inchangé gratuit (304 sans corps), ce qui est le cas courant du
   rafraîchissement décennal. Le protocole différentiel envisagé aurait ajouté de la
   complexité et un risque de dérive entre appareils pour un gain nul. L'ETag exclut
   volontairement l'horodatage de génération, sans quoi il changerait à chaque appel et le
   304 ne servirait jamais.
4. **Le scanner ne réimplémente aucune règle.** Il traduit son manifeste vers la forme que
   consomme `evaluerAcces` (4.1) et appelle le **même code** que le serveur. C'est la raison
   d'être de la séparation faite au chantier précédent.
5. **Une version de badge antérieure vaut « révoqué », pas « inconnu ».** Le manifeste porte
   une entrée par version : sans cela, un badge réédité afficherait « badge inconnu », et
   l'agent conclurait à une erreur de lecture au lieu de retenir le badge périmé.
6. **Le verdict enregistré est celui du scanner**, pas une réévaluation au moment de la
   synchronisation : c'est sur lui que l'agent a agi, et un badge révoqué dix minutes après
   le passage ne doit pas transformer rétroactivement une entrée autorisée en refus. Seul
   garde-fou serveur : une empreinte inconnue ramène le résultat à `UNKNOWN`.

**Sécurité** : la `Permissions-Policy` interdisait la caméra sur tout le site — le scanner
n'aurait pas pu fonctionner. Elle est désormais levée **sur `/scan` uniquement**, et un test
de bout en bout vérifie les deux côtés de la règle. `/scan` exige une session, comme
`/admin`.

**Vérification** : 17 tests unitaires (empreinte client/serveur, contenu du manifeste, ETag,
idempotence de la synchronisation, marquage des présences) et 3 tests de bout en bout dans
l'image Docker de production, dont un qui **coupe réellement le réseau** : verdict rendu,
anti-double-scan appliqué sans serveur, file conservée, reprise sans doublon, participant
passé à `CHECKED_IN`.

**Critères d'acceptation** : reprise sans doublon **vérifiée** (E2E) ; latence scan → verdict
et volume de 200 scans à mesurer sur appareil réel lors de la répétition générale (4.11) — le
faire sur un poste de développement ne mesurerait que la machine.

### 4.3 Espace intervenant (`modules/speakers`) — **fait**

- [x] Lien d'accès intervenant (**C12 levée**), session dédiée de 7 jours.
- [x] Dépôt de la photo, de la biographie (FR/EN) et de la présentation ; statut de confirmation par session, en lecture seule.
- [x] BackOffice `/admin/intervenants` : fiches, publication, bouton « Créer le participant depuis l'intervenant ».
- [x] La photo déposée paraît sur la page publique des intervenants, à la place des initiales.

**C12 cachait un manque plus profond que prévu.** La contradiction signalée portait sur le lien
magique, adossé à `Participant` ; en la traitant, il est apparu qu'un intervenant **n'avait
aucune adresse** dans le modèle — `Speaker.participantId` étant facultatif, un panéliste non
inscrit au Forum était tout simplement injoignable. Deux migrations, donc : `MagicLink` accepte
désormais un destinataire de l'un ou l'autre type, et `Speaker` porte un `email` propre.
L'adresse retenue est la sienne, sinon celle du participant lié ; le BackOffice signale en rouge
les fiches sans adresse, qui ne recevront jamais rien.

**Une seule table pour les deux types de liens**, donc une seule durée de vie, un seul hachage et
les mêmes limites de débit : deux mécanismes parallèles auraient fini par diverger, et c'est le
plus négligé des deux qui aurait porté la faille. Le prix de ce partage est un **cloisonnement
explicite** — un lien d'intervenant ne peut pas ouvrir un espace participant, ni l'inverse. Le
typage a signalé le trou au moment d'ajouter les intervenants ; deux tests le referment, un dans
chaque sens.

**Ce qu'un intervenant peut modifier de lui-même** est volontairement restreint : sa fonction,
son organisation, son pays, sa biographie, sa photo, sa présentation. Ni son rattachement aux
sessions, ni sa publication, ni son statut de confirmation — c'est le comité qui les établit, et
les afficher en lecture seule lui évite d'écrire pour savoir où il en est.

**La présentation n'est jamais publique.** Un support appartient à son auteur et circule entre
lui, le comité et la régie ; sa publication éventuelle relève des Actes (Lot 3), avec son accord.
La photo, elle, devient publique **quand l'intervenant est publié** : un panéliste pressenti qui
se désiste ne doit pas avoir laissé son portrait accessible entre-temps. Trois assertions de bout
en bout tiennent cette règle.

**Vérification** : 9 tests unitaires (adresse de contact, usage unique, expiration, cloisonnement
croisé) et 6 tests de bout en bout dans l'image Docker de production, dont le dépôt réel d'une
photo et d'un PDF, et le refus d'une image renommée en `.pdf`.

### 4.4 Programme et sessions (`modules/sessions`) — **fait**

- [x] CRUD, duplication, brouillon/publié, gestion des salles, dépôt des TDR.
- [x] Page publique : grille **jour × salle**, filtres (thème, type, salle), état par session et compteur de places.
- [x] Fiche session : objectifs, TDR téléchargeable, modérateur et panélistes avec biographie dépliable, lien de diffusion.
- [x] **Jauge de remplissage**, la carte laissée en attente au 4.6 : inscrits sur capacité, avec alerte quand la capacité déclarée dépasse celle de la salle.
- [ ] Réordonnancement par glisser-déposer : non fait, cf. T43.
- [ ] Contributions publiées sur la fiche : relève du **Lot 3**.

**L'état d'une session est calculé à un seul endroit** (`calculerPlaces`, fonction pure) et
consommé par la page publique, l'écran d'administration et — au chantier 4.5 — le contrôle à la
réservation. Un « il reste 3 places » affiché d'un côté et un refus rendu de l'autre serait
incompréhensible pour le participant. Le `vipQuota` n'est volontairement **pas** retranché du
compteur : il réserve une partie des places à une population, il ne réduit pas la salle.

**Ce que la grille dit et ne dit pas.** Les sessions sans salle — ouverture, pauses, déjeuner —
barrent toute la largeur : ce sont des moments communs, et les caler dans une colonne laisserait
croire qu'on peut faire autre chose pendant. Les colonnes sont ordonnées de la plus grande salle
à la plus petite ; l'ordre alphabétique plaçait la salle des ateliers avant la plénière, ce qui
se lit mal. Sous `md`, la grille cède la place à une liste chronologique — quatre colonnes à
cette largeur rendraient les titres illisibles.

**Une session en brouillon renvoie 404 au public, pas 403** : annoncer « interdit » révélerait
qu'un panel se prépare sous ce nom. Un intervenant non publié n'est pas annoncé non plus — un
panéliste affiché puis désisté est un incident de protocole. La duplication repart en brouillon
et réservation fermée, pour la même raison.

**Suppression logique** et refusée dès qu'une inscription existe : une session porte des faits
(qui s'était inscrit, qui est venu) que le rapport du jour J doit pouvoir retrouver.

**Jeu de démonstration** : 4 salles, 8 intervenants, 28 sessions sur trois journées (brief §11),
tous marqués `[DEMO]` dans leurs textes.

**Vérification** : 17 tests unitaires (états et compteurs, validation de saisie, dérivation du
slug) et 4 tests de bout en bout dans l'image Docker de production, qui créent une session par
l'écran réel, vérifient le 404 en brouillon, publient, dupliquent et se voient refuser une
suppression.

### 4.5 Réservation de panels (`modules/sessions`) — **fait**

- [x] `POST /api/v1/sessions/:id/register`, et `DELETE` pour l'annulation : transaction avec **verrouillage de ligne** (C14 levée), tous les contrôles du brief.
- [x] Liste d'attente ordonnée ; annulation → promotion automatique du premier en file + courriel (`session_promoted`).
- [x] BackOffice : inscription/désinscription manuelle par identifiant de badge, export CSV, **feuille d'émargement PDF**, marquage `ATTENDED`.
- [x] Bouton de réservation sur la fiche publique, pour un participant connecté à son espace.

**Le critère d'acceptation est tenu, et le test a des dents.** Vingt demandes simultanées sur une
place unique donnent 1 inscrit et 19 en liste d'attente, à des positions toutes distinctes. Pour
vérifier que ce test prouve quelque chose, le `FOR UPDATE` a été retiré temporairement : **dix
personnes obtenaient alors la même place**. C'est la mesure exacte de ce que le verrou empêche,
et la raison pour laquelle il ne faut pas « simplifier » cette transaction.

Trois points de conception :

1. **La promotion se fait sous le même verrou que la libération de la place.** Entre les deux, une
   réservation concurrente prendrait le siège que la liste d'attente attendait depuis trois
   semaines. Le courriel, lui, part **après** le commit : annoncer une place depuis une
   transaction qui peut encore échouer, c'est un message à démentir.
2. **Le chevauchement horaire est testé par recouvrement d'intervalles** (`début < finAutre` et
   `fin > débutAutre`) plutôt qu'en énumérant les cas — l'énumération oublie toujours
   l'englobement, qu'un test couvre explicitement.
3. **Le quota VIP réserve des places au placement manuel**, pas à une catégorie. Le brief dit
   « en tenant compte du `vipQuota` réservé » sans préciser qui peut y puiser ; c'est la seule
   lecture qui n'oblige pas à qualifier chaque catégorie de VIP ou non, et c'est ainsi que le
   protocole travaille en pratique. **À faire confirmer par l'ANSD.**

**Un défaut d'interface trouvé par le test de bout en bout** : retirer un inscrit promouvait
quelqu'un et lui envoyait un courriel sans que l'agent en soit informé. Le message est désormais
affiché — on doit savoir qu'un courriel est parti à cause de son clic.

**Réutilisation** : la feuille d'émargement d'un panel est **le même document** que celle d'une
journée (4.6). Un second gabarit aurait divergé du premier.

**Vérification** : 18 tests unitaires dont celui de concurrence, et 6 tests de bout en bout, dont
une réservation puis une annulation faites par un participant depuis la fiche publique, avec une
vraie session « Mon espace ».

### 4.6 Présences (`modules/attendance`) — **fait**

- [x] Écran `/admin/presences` : navigation par jour, tableau par point de contrôle, affluence par zone, taux de présence par catégorie et par pays.
- [x] **Export PDF des listes de présence** — deux documents, cf. ci-dessous.
- [x] Flux des scans, rafraîchi toutes les 5 s ; la carte du tableau de bord qui renvoyait au Lot 2 pointe désormais vers cet écran.
- [x] Jauge de remplissage **par salle** : faite au chantier 4.4, qui a apporté les salles et leur capacité.

**Deux documents et non un.** Le brief parle d'une « feuille de présence » ; il en faut en
réalité deux, qui ne servent pas au même moment :

- la **feuille d'émargement** s'imprime _avant_ la séance, avec une colonne de signature — les
  lignes sont volontairement plus hautes que dans l'autre document, une signature manuscrite
  ayant besoin de place ;
- la **liste de présence** s'édite _après_, avec l'heure du premier passage. **Les absents y
  figurent**, marqués comme tels : une liste des seuls présents ne répondrait pas à la question
  qu'on se pose en la lisant, qui est « qui manque ? ».

**Ce qui a été refusé.** Le brief demande une jauge de « remplissage ». Le scan de sortie étant
facultatif (§2.5) et non déployé, un compteur de personnes présentes à l'instant t ne ferait que
croître toute la journée — et donnerait une fausse assurance à qui doit décider d'ouvrir une
salle. Ce qui est affiché s'appelle donc **affluence** : les personnes distinctes passées dans
la journée. Le mot compte autant que le chiffre.

**Interrogation toutes les 5 s plutôt que SSE** (le brief laisse le choix) : une connexion
longue derrière un proxy inverse demande de désactiver la bufferisation et survit mal aux
redémarrages, pour un écran que deux ou trois personnes regardent.

**Les taux sont calculés en une seule requête**, présents et attendus côte à côte. Les compter
séparément puis les rapprocher en mémoire produit des taux supérieurs à 100 % dès qu'un
participant change de catégorie entre les deux lectures — c'est exactement le défaut trouvé à
l'entonnoir du tableau de bord, et l'invariant qui l'avait attrapé est repris ici.

**Vérification** : 9 tests unitaires (comptage de personnes et non de scans, exclusion des refus,
invariant présents ≤ attendus, premier passage retenu, échappement HTML du gabarit) et 4 tests de
bout en bout dans l'image Docker de production, dont la **production réelle des deux PDF** — un
test sur le gabarit HTML ne dit rien du rendu Chromium. Les deux documents ont été relus page à
page.

### 4.7 Inscription sur place (`modules/onsite`) — **fait**

- [x] `/admin/accueil` : recherche (nom, e-mail, téléphone, organisation, identifiant) → valider, générer le badge, imprimer, enregistrer la présence, **sans quitter l'écran**.
- [x] Formulaire minimal → participant `CONFIRMED`, `source=ONSITE` → badge → impression → présence.
- [x] Photo par webcam facultative, cadrée carré et ré-encodée en JPEG (les métadonnées disparaissent au passage, comme pour la photo en ligne).

**La présence emprunte le chemin des scans.** Une présence saisie au comptoir et une présence
scannée à la porte doivent être **le même fait** : même table, même idempotence par
`clientScanId`, mêmes comptages dans les rapports du jour J. Écrire une seconde voie aurait
produit deux vérités et un écart à expliquer le 26 novembre.

**Un seul bouton, quel que soit l'état du dossier.** Le comptoir ne reconfirme pas un participant
déjà confirmé et ne réédite pas un badge valide — rééditer invaliderait le QR déjà imprimé que la
personne a peut-être en main. L'agent presse le même bouton pour un invité, un inscrit à valider
ou quelqu'un qui repasse, ce qui lui évite d'avoir à en juger devant la file.

**Sans e-mail ni téléphone, on refuse ; avec l'un des deux, on inscrit.** Le modèle impose un
e-mail unique par édition ; pour qui se présente au comptoir sans adresse, une adresse de repli
visiblement factice (`@onsite.invalid`) est fabriquée, à laquelle rien n'est jamais écrit. Refuser
l'inscription faute d'adresse aurait bloqué quelqu'un physiquement présent.

**La caméra a dû être ouverte sur cet écran.** La `Permissions-Policy` ne l'autorisait que sur
`/scan` ; les deux chemins sont désormais **énumérés** plutôt que couverts par un préfixe, pour
qu'ajouter un écran d'administration ne l'autorise pas par inadvertance. Un test de bout en bout
vérifie les deux côtés : `camera=(self)` sur `/admin/accueil`, `camera=()` sur
`/admin/participants`.

**Objectif de 90 secondes** : la chaîne serveur est enchaînée en un appel (validation, badge,
présence) et le rendu d'un badge est mesuré à ~200 ms. Le chiffre lui-même reste **à chronométrer
à la répétition générale** (4.11), avec un vrai agent et une vraie imprimante : le mesurer ici ne
mesurerait que la machine de développement.

**Vérification** : 8 tests unitaires (recherche, exclusion des annulés, non-réédition du badge,
présence idempotente) et 5 tests de bout en bout dans l'image Docker de production, dont le
parcours complet d'un inconnu jusqu'au badge imprimable.

### 4.8 Impression de badges en masse — **fait**

- [x] Écran `/admin/badges` : filtres catégorie / délégation / état du badge, génération en lot du périmètre, compteur d'impressions.
- [x] **Export ZIP rangé par délégation** — un dossier par délégation, plus « Sans délégation ».
- [x] **Planche d'impression** au format carte (85,6 × 54 mm), un badge par page.

**La génération passe par la file, pas par la requête.** Rendre 500 badges prend environ deux
minutes ; aucune requête HTTP ne doit attendre cela. L'écran annonce donc une **mise en file**, et
non une génération : dire « générés » ferait chercher des fichiers qui n'existent pas encore. Les
participants déjà pourvus d'un badge valide sont écartés du lot — le bouton sert à rattraper ce
qui manque, pas à tout refaire, et régénérer invaliderait des QR déjà imprimés.

**Un écrivain ZIP maison, de vingt lignes utiles** (`src/lib/zip.ts`), en méthode « stockée ».
Le contenu est exclusivement des PDF, déjà compressés : les recompresser coûterait du temps
processeur pour quelques pourcents, et une bibliothèque de compression n'aurait servi qu'à
assembler un conteneur. Le choix n'est défendable **que parce qu'il est vérifié pour de bon** :
le test de bout en bout extrait l'archive avec `Expand-Archive` — l'outil du système, seul juge
valable — et compare les fichiers obtenus. Une archive que nous serions seuls à savoir lire ne
servirait à rien le jour où l'ANSD la reçoit.

Un piège rencontré au passage : la sortie console de PowerShell est en page de code locale, et
les noms accentués en ressortaient mutilés **alors qu'ils étaient corrects sur le disque** —
vérifié en comparant les codes Unicode (`é` = 233, `ô` = 244). Le test encode donc les noms en
base64 avant de les remonter, pour ne pas échouer sur un artefact d'affichage.

**La planche affiche le PNG déjà rendu**, pas un gabarit réinterprété par le navigateur : ce qui
sort de l'imprimante est exactement ce qui a été vérifié à la génération, sans dépendre des
polices installées sur le poste de l'accueil. La règle `@page` fixe le format carte ; sur A4,
l'agent choisit « plusieurs pages par feuille ».

**Le nombre de badges manquants voyage dans un en-tête de réponse** (`X-Badges-Manquants`) : une
archive de 180 fichiers là où on en attendait 200 doit se voir sans avoir à l'ouvrir.

**Vérification** : 9 tests unitaires sur le format ZIP (signatures, répertoire central, CRC,
drapeau UTF-8, archive vide, assainissement des noms) et 5 tests de bout en bout, dont
l'extraction réelle.

### 4.9 Rapports et exports (`modules/reporting`) — **fait**

- [x] Sept rapports en **XLSX, CSV et PDF** depuis `/admin/rapports` : participants, présences, remplissage des sessions, entonnoir, répartition, délégations, badges.
- [x] Chaque édition est **journalisée** — qui, quoi, quel format, combien de lignes, combien de temps.
- [ ] Mode asynchrone au-delà de 1 000 lignes : **délibérément non construit**, cf. mesures ci-dessous.

**Le catalogue est une interprétation.** Le brief renvoie aux « rapports listés §23 » de la
spécification fonctionnelle, dont le contenu détaillé ne nous est pas parvenu sous une forme
exploitable. Les sept rapports couvrent ce que les données permettent et ce que les autres
sections du brief nomment explicitement. Ajouter ou retirer un rapport tient en une entrée du
tableau `RAPPORTS`. **À faire valider par l'ANSD.**

**Un rapport se décrit une fois, les formats n'en savent rien.** Colonnes et lignes vivent dans
`service.ts` ; CSV, XLSX et PDF partent des mêmes valeurs. C'est ce qui garantit qu'un chiffre lu
dans le PDF est celui du tableur — trois requêtes légèrement différentes pour un même chiffre est
exactement le défaut qu'on a déjà corrigé au tableau de bord et aux présences.

**Mesures sur 1 500 participants** (chargés puis retirés) :

| Format                 | Temps        | Poids      |
| ---------------------- | ------------ | ---------- |
| CSV                    | 360 ms       | —          |
| XLSX                   | 700 ms       | —          |
| PDF sans plafond       | **9 900 ms** | **6,8 Mo** |
| PDF borné à 300 lignes | 2 600 ms     | 1,4 Mo     |

**D'où l'écart assumé au brief.** Le brief prévoit un mode asynchrone au-delà de 1 000 lignes. La
mesure montre que le volume n'est pas le problème — le tableur sort en moins d'une seconde — mais
que le seul format PDF s'effondre. Et surtout : **un PDF de 1 500 lignes n'est pas un document
qu'on lit ou qu'on imprime**. Le PDF est donc borné à 300 lignes (environ huit pages en paysage),
avec un avertissement dans le document lui-même renvoyant vers l'export Excel. Aucun export ne
dépasse alors trois secondes, ce qui rend la file inutile plutôt que de la construire pour un cas
qui ne se présente plus. **À confirmer par l'ANSD** avec le contenu du §23.

**La journalisation n'est pas décorative** : un rapport « Participants » contient des adresses et
des téléphones. Savoir qu'il est sorti, par qui et quand, fait partie du dispositif de protection
des données autant que le contrôle d'accès qui le précède. La durée d'édition y figure aussi,
pour pouvoir rejuger la question de l'asynchrone sur des données réelles.

**Vérification** : 11 tests unitaires sur les formats (BOM UTF-8, échappement du séparateur et des
guillemets, relecture du classeur, nom d'onglet raccourci, largeurs de colonnes, échappement HTML,
en-tête répété, plafond du PDF) et 5 tests de bout en bout qui éditent **les sept rapports dans
les trois formats** depuis l'image de production.

### 4.10 Rappels planifiés et performance — **fait**

- [x] Rappels **J-7 et J-1** programmés avec `runAt`, depuis `/admin/notifications`.
- [x] **C13 tranchée** : le cache de 60 s est posé sur les données, pas sur les pages. **T35 close** par la mesure.
- [x] Scripts `k6` écrits pour les trois points critiques — **non exécutés ici**, cf. ci-dessous.

**Deux défauts trouvés en écrivant les rappels.** Le premier : `enqueueNotification` n'acceptait
pas de date d'envoi, si bien qu'un rappel « dans sept jours » serait parti à la seconde où on
l'aurait planifié. Le second : la clé d'idempotence de la file ne protège pas d'un second envoi,
BullMQ effaçant les jobs terminés — reprogrammer après l'échéance aurait réécrit à tout le monde.
Le garde-fou porte donc sur `NotificationLog`, qui garde la trace. Le bouton est ainsi rejouable
sans hésiter après avoir confirmé vingt inscriptions de plus, et l'écran dit combien ont été
programmées et combien ignorées.

Une échéance dépassée est **sautée et signalée**, jamais envoyée en retard : recevoir « le Forum
commence dans sept jours » la veille de l'ouverture décrédibiliserait tout le dispositif.

#### C13 et T35 : l'ISR n'aura pas lieu, et c'est mesuré

**Constat, par l'observation et non par lecture de code** : `/` renvoie `lang="en"` avec le
cookie `NEXT_LOCALE=en`, `data-theme="dark"` avec le cookie de thème, et
`Cache-Control: no-store`. La page est donc rendue à chaque requête, et l'ISR demandé au §8 est
hors d'atteinte en l'état.

**Ce qu'il faudrait pour l'obtenir** : déplacer la langue dans l'URL — donc réécrire toutes les
adresses publiques, leur référencement, le plan du site et tous les liens — ce qui revient à
défaire la décision d'architecture prise au Lot 0 (langue en cookie, sans préfixe d'URL).

**Ce que cela rapporterait** : rien de mesurable à la charge visée. TTFB de l'accueil après
préchauffage : **43 à 74 ms** sur cinq appels consécutifs. Les cibles du §8 — 2 scans/s,
300 réservations en 10 minutes — sont d'un ordre de grandeur en dessous de ce qu'un rendu
dynamique absorbe.

**Décision** : le cache de 60 s est appliqué **aux données** plutôt qu'aux pages. Ce qui coûte
est la lecture en base, et elle ne dépend ni du thème ni de la langue du visiteur. Les blocs
éditoriaux sont désormais lus en **une seule requête mise en cache 60 s** (l'accueil en demandait
trois séparément), avec invalidation immédiate à l'enregistrement — sans quoi un texte corrigé
mettrait une minute à paraître et l'éditeur croirait sa saisie perdue. Les chiffres clés de
l'accueil étaient déjà en cache 5 minutes. **T35 est close** : l'écart de score Lighthouse relevé
était du bruit de machine, pas un défaut structurel.

#### Tests de charge : écrits, non exécutés

`k6/` contient les trois scénarios du §8 — réservation, synchronisation de scans, comptoir — avec
leurs seuils et un `README` qui dit comment les lancer. **Ils n'ont pas été exécutés** : `k6`
n'est pas installé sur ce poste, et les faire tourner contre une base de démonstration à
19 participants ne prouverait rien. Ils sont destinés au serveur de recette (T1), avec un jeu de
données représentatif.

Ce qu'ils surveillent n'est d'ailleurs pas le débit — les cibles sont modestes — mais la
**justesse sous charge** : aucune sur-réservation, aucun doublon de présence au renvoi d'un lot.
Les deux propriétés sont déjà tenues par des tests unitaires (20 candidats simultanés sur une
place, renvoi de lot idempotent) ; k6 les vérifiera à l'échelle réelle.

**Vérification** : 7 tests unitaires sur les rappels (date d'envoi, passage de mois, échéance
dépassée, destinataires, idempotence) et 3 tests de bout en bout, dont un qui confirme que la
page publique reste traduite malgré la mise en cache.

### 4.11 Répétition générale — **guide fait, exercice à organiser**

- [x] **Guide de 2 pages pour les agents d'accueil** (livrable explicite du brief §14) : source unique `docs/guide-agents-accueil.html`, PDF édité par `pnpm guide:agents`.
- [ ] 50 badges imprimés, 3 points de contrôle, agents formés — **exercice à caler dans le calendrier avec l'ANSD**.
- [ ] Coupure réseau volontaire pendant l'exercice.

**Le guide dit ce que le code fait**, pas ce que le brief prévoyait : les sept verdicts y figurent
avec leur libellé exact tel qu'il s'affiche à l'écran, relevés dans `decision.ts` et non de
mémoire. Un guide qui annoncerait un message différent de celui que l'agent lit serait pire que
pas de guide.

**Une seule source, et le PDF fabriqué à la demande.** Le PDF n'est pas versionné : le document
distribué doit être celui du texte courant, et un PDF committé aurait vieilli au premier
changement de procédure sans que personne s'en aperçoive. Le compte de pages est vérifié
(exactement deux, recto-verso).

**Ce que le guide dit franchement aux agents**, parce que le taire coûterait plus cher le jour J :
pendant une coupure, une personne inscrite dans les dernières minutes peut manquer à la copie
locale, et deux tablettes tenant la même porte ne se voient pas (T40). Il rappelle aussi de ne
jamais rééditer un badge existant pour dépanner — le QR déjà imprimé cesserait de fonctionner.

**Trois emplacements restent à compléter par l'ANSD** avant impression : l'adresse de
l'application (dépend de T1) et les numéros du comptoir, de l'accréditation et de l'assistance.
Ils sont signalés en rouge dans le document.

**Ce qui reste n'est pas du code.** La répétition demande des badges imprimés, des appareils
réels, des agents et une salle. C'est le critère de sortie du Lot 2 : à programmer avec l'ANSD,
en gardant à l'esprit que le **gel fonctionnel est le 16 novembre**.

---

## 5. Discipline de fin de module (rappel §15.4)

À la fin de **chaque** module ci-dessus :

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` doivent passer.
2. `README.md` mis à jour (installation, comptes de démo, procédure concernée).
3. Ce `PLAN.md` mis à jour : cases cochées, nouveaux TODO ajoutés au tableau ci-dessous, décisions prises en §0 basculées de « proposée » à « confirmée ».
4. Une PR par module (Conventional Commits).

---

## 6. TODO ouverts (aucun TODO silencieux — §15.5)

| #   | TODO                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Priorité  | Lot                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------- |
| T1  | Obtenir de l'ANSD : hébergement définitif + nom de domaine (cf. C6). **À traiter dans le même mouvement, sous peine de l'oublier** : (a) **TLS entre l'application et MySQL** — le contournement de T39 (`allowPublicKeyRetrieval`) ne tient que tant que ce lien reste sur un réseau privé ; dès qu'il traverse quoi que ce soit d'exposé, il faut du TLS, sans quoi le mot de passe de la base voyage protégé par une clé publique que rien n'authentifie ; (b) **HTTPS obligatoire pour le scanner** (T41) ; (c) les accès `root` MySQL nécessaires à la création des migrations (T38)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Bloquante | Mise en prod Lot 1                |
| T32 | ~~Le formulaire public d'inscription n'aboutit pas~~ — **résolu**. Cause : la sérialisation automatique de React (`<form action={formAction}>`) envoyait des valeurs **périmées** — champs de consentement valant `on` dans le DOM, `_1_consentTerms=off` dans la requête. Aucune inscription ne pouvait aboutir depuis un navigateur, et le message affiché (« Vous devez accepter les conditions ») accusait l'utilisateur. Correction : le `FormData` est construit explicitement à partir du DOM vivant dans `handleSubmit`, puis passé à l'action via `startTransition(() => formAction(data))` ; les consentements y sont réécrits depuis l'état React, qui fait autorité pour ces trois valeurs. Défaut présent depuis le module 3.4, invisible au typecheck, au lint et aux 87 tests — seul le pilotage d'un navigateur pouvait le révéler.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —         | T25 (fait)                        |
| T2  | Obtenir de l'ANSD : identifiants SMTP institutionnel ou confirmation Brevo (cf. C7)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Haute     | Mise en prod Lot 1                |
| T3  | Obtenir de l'ANSD : logos officiels + charte graphique (cf. C3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Moyenne   | Cosmétique, non bloquant          |
| T4  | Obtenir clé Turnstile/reCAPTCHA (cf. C4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Moyenne   | 3.4                               |
| T5  | ~~Confirmer la décision de session participant par cookie JWT plutôt qu'une table dédiée (cf. C2)~~ — **implémenté** en 3.5 (`modules/auth/participant-session.ts`, JWT HS256 httpOnly 30 j). Reste à faire trancher par l'ANSD : un JWT ne se révoque pas sans liste noire, donc une session volée reste valide jusqu'à son expiration. Si une révocation immédiate est attendue, prévoir une table de sessions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Haute     | 3.5                               |
| T6  | Impression physique des badges (fenêtre `@page` format badge) et export ZIP par délégation : à confirmer si inclus en Lot 1 ou reporté en Lot 2 selon avancement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Moyenne   | 3.6                               |
| T7  | Charge légère sur les 3 endpoints rate-limités avant ouverture publique (k6 complet reporté en Lot 2, cf. §8)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Basse     | 3.10                              |
| T8  | ~~Le conteneur MySQL de développement était lancé à la main~~ — **résolu** : `docker-compose.yml` (mysql + redis + mailpit + minio) livré en 0.8. Le conteneur `docker run` manuel (port hôte 3308) reste utilisable en parallèle pour du débogage ponctuel. **Leçon apprise** : ce conteneur ad hoc n'a pas de volume nommé — un redémarrage de Docker Desktop (survenu en cours de session) a fait perdre son volume anonyme, donc toutes les données. Sans conséquence ici (seed régénéré en une commande), mais confirme qu'un `docker-compose up` avec volume nommé (déjà prévu dans `docker-compose.yml`) est la bonne pratique dès qu'on veut des données qui survivent — pas ce conteneur manuel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —         | 0.8 (fait)                        |
| T9  | Secrets `AUTH_SECRET`/`MAGIC_LINK_SECRET`/`BADGE_HMAC_SECRET` générés aléatoirement pour le `.env` de **développement local** (fait) — à régénérer séparément pour chaque environnement de déploiement, même de test ; ne jamais réutiliser ceux du dépôt/`.env.example`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Haute     | Mise en prod                      |
| T10 | Seed : 18 participants `[DEMO]` + 2 délégations ajoutés avec le module 3.1 (statuts variés : REGISTERED/CONFIRMED/DECLINED/CANCELLED, via le vrai `service.ts`). Reste à ajouter au fil des modules restants : 3 jours × 10 sessions, 25 intervenants, et monter au volume cible de 300 participants une fois le module Sessions disponible pour donner un contexte cohérent aux réservations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Basse     | 3.1 (fait, partiel) / 3.9 (Lot 2) |
| T11 | ~~Installer Puppeteer et implémenter réellement `src/lib/pdf.ts`~~ — **fait** au module 3.6 : `puppeteer-core` + Chromium système (Alpine), pool d'onglets, PDF CR80 et PNG.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | —         | 3.6 (fait)                        |
| T13 | `nodemailer` (9.1.0), `@eslint/eslintrc` (3.3.6) épinglés en version exacte, et `lru.min` forcé à 1.1.4 via `pnpm.overrides` : la politique anti-chaîne-d'approvisionnement de l'environnement de build (`minimumReleaseAge`) rejette les paquets publiés depuis moins de ~24 h. Repasser en plage `^` normale à l'occasion d'une prochaine mise à jour de dépendances, une fois ces versions naturellement plus anciennes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Basse     | Maintenance continue              |
| T14 | ~~2FA jamais rejouée en navigateur~~ — **levée** : inscription TOTP puis connexion complète (e-mail + mot de passe + code à 6 chiffres) rejouées contre l'image de production, session obtenue et pages BackOffice servies en 200. Le compte de démonstration a désormais la 2FA activée.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —         | 3.8 (fait)                        |
| T15 | `@tanstack/react-table` (dernière version, 9.x) a renommé toute l'API « classique » (`useReactTable`→`useLegacyTable`, `ColumnDef`→`LegacyColumnDef`, `flexRender` déplacé vers `/flex-render`) derrière un sous-chemin `/legacy` — surprise non documentée dans mes connaissances. Utilisé tel quel (`participants-table.tsx`) : fonctionnel, mais à surveiller lors d'une montée de version future si l'API "legacy" venait à être dépréciée.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Basse     | 3.1 (information)                 |
| T16 | Formulaires BackOffice (`ParticipantForm`, `DelegationForm`) volontairement écrits en formulaire HTML natif + Server Action plutôt qu'avec `react-hook-form` (cité au brief §3.1) : les deux se marient mal (RHF pilote la soumission côté client, les Server Actions attendent un `FormData` natif). `react-hook-form` réservé au formulaire public d'inscription multi-étapes (module 3.4), où sa valeur (validation live, étapes) est réelle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Basse     | 3.4 (à confirmer)                 |
| T17 | `ContentBlock`/`Post` utilisent du texte brut (pas de HTML) : plus sûr sans sanitisation dédiée, mais ne permet ni gras/italique/liens/listes ni médias. Si un vrai éditeur riche est souhaité, prévoir un éditeur (ex. Tiptap, déjà mentionné au brief pour les Contributions) + sanitisation serveur (ex. DOMPurify côté Node) avant stockage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Moyenne   | 3.2 (raffinement)                 |
| T18 | Historique des 10 dernières versions de `ContentBlock` (mentionné au brief §3.2) non implémenté — le schéma Prisma du brief §4 ne prévoit pas de table de versions pour `ContentBlock`. Ajouter une table `ContentBlockVersion` (ou un tableau JSON des versions précédentes) si cette fonctionnalité est jugée nécessaire.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Basse     | 3.2 (raffinement)                 |
| T19 | ~~Critère Lighthouse ≥ 90 non vérifié~~ — **fait**, avec une réserve sur la seule performance. Outillage : `pnpm audit:lighthouse [pages]`, qui **préchauffe** chaque page (le premier appel après démarrage du conteneur coûtait 18 points et 860 ms de réponse serveur — une situation qu'aucun visiteur ne rencontre ; le TTFB réel mesuré est de 112 ms) et retient la **médiane de trois exécutions**. Résultats sur huit pages publiques : **accessibilité 100 et SEO 100 partout**, bonnes pratiques 96 à 100 ; performance de 90 à 96, sauf l'accueil (80 à 91 selon les exécutions, médiane ~88). Quatre défauts d'accessibilité réels corrigés (cf. T34), tous invisibles jusqu'à cet audit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | —         | 3.2 / 3.10                        |
| T20 | ~~`xlsx` en 0.18.5 depuis npm (ReDoS connu)~~ — **résolu, décision ANSD** : installé depuis le registre officiel SheetJS (0.20.3, épinglé avec intégrité dans le lockfile). Build Docker vérifié avec ce registre. **Point d'attention CI/CD** : tout environnement de build (GitHub Actions, futur serveur de déploiement) doit pouvoir joindre `cdn.sheetjs.com` en plus de `registry.npmjs.org` — à vérifier si une allowlist réseau est en place chez l'ANSD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | —         | 3.3 (fait)                        |
| T22 | **Exploitation** : incident rencontré en dev — après une coupure de Redis, les tentatives de connexion avortées ont dépassé `max_connect_errors` (défaut : 100) et **MySQL a bloqué l'hôte applicatif** (`Aborted_connects` = 212), rendant l'app inutilisable jusqu'à un `mysqladmin flush-hosts`. En production, prévoir un `max_connect_errors` élevé (ex. 100000) dans la config MySQL du `docker-compose.prod.yml`, sinon un simple redémarrage de dépendance peut couper l'app durablement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Haute     | 3.10 (mise en prod)               |
| T21 | L'enregistrement des handlers de jobs est paresseux (à la première mise en file, côté Node). Conséquence : une instance qui ne met jamais de job en file ne consomme pas la file. Sans impact dans le déploiement prévu (une seule app qui produit et consomme), mais à revoir si un worker séparé est introduit — auquel cas prévoir un vrai point d'entrée worker.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Basse     | Architecture (à surveiller)       |
| T23 | **À arbitrer** : brouillon d'inscription côté serveur (brief §5.3 « localStorage + serveur dès qu'un e-mail est saisi »). Non implémenté — cela suppose d'écrire une ligne depuis un formulaire public anonyme (surface de spam). Options : (a) s'en tenir au localStorage + reprise par lien magique (état actuel), (b) créer un `Participant` en `REGISTRATION_STARTED` dès l'e-mail saisi, protégé par captcha + rate limit, (c) table de brouillons dédiée avec purge automatique.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Moyenne   | 3.4 (à décider)                   |
| T24 | ~~Photo de profil : téléversement et recadrage~~ — **fait**. Recadrage carré dans le navigateur (canvas, sortie 512 px en JPEG), proposé à l'inscription **et** dans « Mon espace », où la photo peut être ajoutée, remplacée ou retirée après coup. Trois propriétés qui ne vont pas de soi : (1) le ré-encodage par le canvas **efface les métadonnées EXIF**, dont la géolocalisation que les téléphones inscrivent dans les photos — un fichier transmis tel quel aurait publié la position du domicile sur le badge ; (2) le serveur déduit le type des **octets du fichier**, jamais du `Content-Type` déclaré : un script renommé en `.jpg` est refusé, et un test le vérifie ; (3) le recadrage se règle à la souris **et au clavier**, un contrôle uniquement glissable étant inaccessible. La photo est servie par une route sous contrôle d'accès (participant concerné ou BackOffice), jamais depuis le webroot, et ne figure pas sur la page publique de vérification (§2.11). 9 tests unitaires ; le parcours E2E dépose une image et vérifie qu'elle arrive recadrée.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —         | 3.6 (fait)                        |
| T25 | ~~Test bout-en-bout impossible ici~~ — **fait** : Playwright (`pnpm e2e`), branché sur l'image Docker de production plutôt que sur `next dev`. **17 tests** : la suite « sécurité » (10) verrouille les régressions du chantier 3.10 — en-têtes, CSP à nonce (dont un test vérifiant que le nonce _change_ à chaque requête) et garde de `/admin` ; le parcours d'inscription (7) couvre inscription → doublon refusé → confirmation par le comité → génération et téléchargement du badge → vérification publique sans donnée superflue. TOTP réimplémenté dans les tests (RFC 6238) plutôt que réutilisé depuis `otplib` : le chargeur de Playwright échouait dessus, et la 2FA se trouve ainsi validée contre une implémentation **indépendante** de la norme.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | —         | 3.10 (fait)                       |
| T31 | Les textes de `/confidentialite` et `/mentions-legales` sont des **brouillons marqués comme tels** en tête de page. Ils engagent juridiquement l'ANSD : à relire et valider par le responsable de traitement et le délégué à la protection des données, et à compléter (directeur de publication, hébergeur) avant l'ouverture publique. Le marqueur rend une mise en ligne par oubli impossible à manquer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Haute     | Avant ouverture publique          |
| T30 | Le statut `BOUNCED` (rebond dur signalé par le serveur SMTP) est implémenté mais jamais rejoué : Mailpit accepte tout destinataire. À vérifier contre le SMTP institutionnel réel lors de la mise en production, en même temps que T2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Basse     | 3.10 (mise en prod)               |
| T33 | Fiabilité de la suite unitaire, réglée au passage : les fichiers de test partageaient **la même file BullMQ** sur un Redis commun, si bien qu'un worker traitait les jobs d'un autre fichier — badges créés à contretemps, collisions sur `Badge_qrToken_key`, échecs jamais reproductibles isolément. Le nom de file est désormais paramétrable (`QUEUE_NAME`) et unique par processus de test ; il servira aussi à séparer recette et production sur un Redis commun. Le parallélisme est par ailleurs plafonné à 3 fichiers : au-delà, argon2 et le rendu PDF s'affamaient et expiraient sans qu'aucun défaut applicatif soit en cause. Le fichier de tests d'authentification a par ailleurs son propre délai (90 s) : argon2 est volontairement coûteux et expirait sous charge sans qu'aucun défaut applicatif soit en cause. **Observé aussi sur les tests de bout en bout (7 septembre)** : une suite complète lancée juste après la suite unitaire a mis **20 minutes au lieu de 8,2** et perdu deux tests sur expiration d'attente ; relancés isolément puis en suite complète machine au repos, les 61 tests passent. L'ordre d'écriture des badges a été vérifié à cette occasion — `renderAndStore` écrit les fichiers **avant** la mise à jour de `pdfPath`, donc l'attente des tests est saine et il ne s'agit pas d'une course. Ne pas enchaîner les deux suites sur un poste chargé, et confirmer en CI où l'environnement est propre. Une intermittence résiduelle subsiste sur cette machine après plusieurs heures de charge (un test différent à chaque fois, systématiquement vert en isolation) : à surveiller en CI, où l'environnement est propre. | —         | T25 (fait)                        |
| T34 | Correctifs d'accessibilité issus de l'audit T19, consignés parce qu'ils touchent des jetons de design partagés : (1) le gris atténué `--text-3` ne tenait que **3,21:1** en thème sombre et **2,83:1** en thème clair — le thème clair était le pire des deux et n'avait jamais été signalé, l'audit tournant en sombre ; valeurs recalculées à 4,78:1 et 4,81:1 au pire sur toutes les surfaces. (2) Le lien du logo n'avait **aucun nom accessible** en dessous de 2xl, le libellé textuel y étant masqué et la pastille décorative : `aria-label` ajouté. (3) Les boutons `bg-ansd-bleu-vif` + texte blanc plafonnaient à 4,14:1 ; nouveaux jetons `--btn-blue` / `--btn-blue-text` (7,01:1 en clair, 8,62:1 en sombre), suivant le motif fond clair / texte foncé déjà retenu pour `--primary`. (4) Les niveaux de titre sautaient des paliers — pied de page en `h4` sous un `h1`, titres d'actualités et de niveaux de sponsors en `h3` — ce qui désoriente la navigation par titres des lecteurs d'écran ; corrigés en `h2`, la taille restant portée par les classes. Toutes les valeurs sont **calculées**, pas choisies à l'œil.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —         | T19 (fait)                        |
| T35 | Performance de la page d'accueil : mesurée entre 80 et 91 selon les exécutions (médiane ~88), là où les sept autres pages publiques tiennent 90 à 96. L'écart entre deux mesures d'une même page atteint 10 points sur ce poste de développement — Lighthouse mesure aussi la charge de la machine, saturée par les conteneurs et le navigateur. L'accueil est par ailleurs la page la plus lourde (compte à rebours au rythme d'une seconde, chiffres en direct, liste d'actualités). À re-mesurer sur le serveur de production, au calme, avant de conclure : optimiser au jugé sur une mesure aussi bruitée ferait courir le risque de complexifier le code sans gain réel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Moyenne   | 3.10 (mise en prod)               |
| T26 | Le job `participant.deletion_request` (demande de suppression RGPD, module 3.5) est mis en file mais **n'a pas encore de handler** — même situation que `badge.generate` avant le module 3.6. L'anonymisation effective relève du Lot 3 ; d'ici là les demandes sont tracées dans `AuditLog` et doivent être traitées manuellement par le comité.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Moyenne   | Lot 3 (traçage OK entre-temps)    |
| T27 | ~~Server Actions non rejouables~~ — **contourné** : elles ne sont effectivement pas rejouables en `curl`, mais un navigateur piloté (Puppeteer, déjà installé pour les badges) le fait très bien, avec une session 2FA réelle. C'est ainsi que le défaut de confirmation de l'envoi groupé a été trouvé. À industrialiser avec T25 (Playwright).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Moyenne   | 3.9 (avec T25)                    |
| T28 | ~~Les QR des badges encodent `/v/:token`, page servie par le module 3.7~~ — **levé** : la page existe et a été vérifiée bout en bout (QR scanné → « Badge valide »).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —         | 3.7 (fait)                        |
| T29 | ~~Écart assumé au gabarit visuel sur l'en-tête~~ — **résolu par regroupement thématique du menu** (décision ANSD) : les 7 entrées à plat (737 px) deviennent 5 dont 2 menus déroulants (467 px), et l'en-tête tient dans le conteneur de 1200 px du gabarit, sans élargissement ni suppression d'élément. Vérifié sans débordement de 390 à 1920 px, en FR comme en EN.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | —         | 3.7 (fait)                        |
| T36 | **Écart assumé au brief sur le scan orange.** §2.5 range la « première présence du jour » parmi les motifs d'alerte orange, au même titre que les VIP. Appliqué à la lettre, cela rendrait orange la quasi-totalité des scans du matin à l'entrée principale — et un agent qui voit vingt oranges d'affilée cesse de lire la couleur, ce qui vide le feu tricolore de son sens. La mention est donc **affichée** sous le verdict, mais ne fait pas basculer la couleur ; seules les catégories marquées « à accueillir » et le double-scan passent en orange. Un test verrouille ce comportement. À faire arbitrer par l'ANSD avec C9.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Basse     | 4.1 (fait)                        |
| T37 | Le drapeau « à accueillir » se règle depuis `/admin/zones`, faute d'écran d'administration des catégories : c'est le bon endroit fonctionnellement (il pilote la couleur du scan), mais les autres réglages de catégorie (validation automatique, logistique, couleur du badge) restent au seul `seed.ts`. Un écran « Catégories » les réunirait ; il n'est demandé par aucun lot et n'est pas urgent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Basse     | 4.1 (fait)                        |
| T38 | **Création des migrations Prisma** : l'utilisateur applicatif `forum` n'a pas le droit `CREATE DATABASE`, dont Prisma a besoin pour sa base fantôme. `prisma migrate dev` échoue donc en P3014, et une migration doit être **créée** avec l'utilisateur `root` (`DATABASE_URL=mysql://root:root@localhost:3308/... pnpm prisma migrate dev`). L'**application** en production passe par `migrate deploy`, qui n'utilise pas de base fantôme et fonctionne avec l'utilisateur applicatif. À consigner dans le README au moment de T1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Basse     | 4.1 (fait)                        |
| T39 | **Défaut de production trouvé en reprenant le conteneur, sans rapport avec le scanner.** MySQL 8.4 authentifie par `caching_sha2_password` et ne garde en cache que les comptes authentifiés **depuis son dernier démarrage** ; cache vide, le client doit récupérer la clé publique RSA du serveur, échange que le connecteur MariaDB refuse sur une connexion non chiffrée sans autorisation explicite. Conséquence : après **tout redémarrage de la base** — sauvegarde, mise à jour, coupure — l'application repartait en erreur avec pour seul message un « pool timeout » qui ne désigne rien. Reproduit (`FLUSH PRIVILEGES` + redémarrage → 500) puis corrigé dans `src/lib/db.ts`, et la correction est vérifiée dans les mêmes conditions. Le compromis (`allowPublicKeyRetrieval`) tient parce que le lien application ↔ base reste sur un réseau privé ; sur un lien exposé, la bonne réponse est le **TLS vers MySQL**, à mettre en place avec T1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Haute     | Corrigé, TLS à faire avec T1      |
| T40 | **L'anti-double-scan est par appareil.** Hors ligne, deux tablettes postées à la même entrée ne peuvent pas se voir : la règle des deux minutes (§2.5) vaut donc par appareil, pas par point de contrôle. La faire porter sur le serveur reviendrait à la perdre exactement quand le réseau manque, c'est-à-dire quand elle sert. À dire à l'ANSD, et à éprouver à la répétition générale (4.11) : si deux postes doivent réellement partager une file, la réponse est un appareil par file, pas une règle serveur.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Moyenne   | 4.2 (fait)                        |
| T41 | Le scanner exige un **contexte sécurisé** : `crypto.subtle` (empreinte du QR) et l'accès caméra ne sont accordés qu'en HTTPS ou sur `localhost`. Un scanner servi en HTTP clair depuis une IP de réseau local — tentation naturelle le jour J si le Wi-Fi du site est isolé — n'aurait ni l'un ni l'autre, et échouerait de façon peu explicite. À vérifier au déploiement, avec T1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Moyenne   | 4.2 (fait)                        |
| T42 | Fragilité de test corrigée au passage : le parcours du badge attendait le libellé « v1 », qui apparaît dès la **création de la ligne**, avant l'écriture des fichiers. La confirmation d'un participant met un job `badge.generate` en file ; un clic manuel peut donc trouver la ligne déjà créée par le worker encore en train de rendre. Le test attend désormais les fichiers eux-mêmes. L'écran, lui, était juste : il affiche « en attente de génération » et ne propose pas de lien PDF tant qu'il n'y en a pas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | —         | 4.2 (fait)                        |
| T43 | **Réordonnancement des sessions par glisser-déposer** (§5.8) : non fait. L'ordre d'affichage découle de l'horaire, qui est la donnée réelle ; un ordre manuel qui le contredirait produirait une grille fausse. Si l'ANSD veut réordonner deux sessions à la même heure dans la même salle, le champ `number` existe déjà et suffirait — à confirmer avant de coder une interface de glisser-déposer dont personne n'a encore décrit l'usage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Basse     | 4.4 (fait)                        |
| T44 | Défaut trouvé en exerçant l'écran réel, invisible au typage comme au lint : une constante exportée depuis un fichier `"use server"` (`TDR_MAX_BYTES` dans `actions.ts`). Next n'autorise que des fonctions asynchrones à cet endroit et ne le signale qu'à l'exécution — la page de création de session rendait une erreur serveur. Constante déplacée dans `schema.ts`. À garder en tête pour les prochains modules : **tout export non-fonction dans un fichier d'actions casse la page**, et seul un passage dans l'application le montre.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | —         | 4.4 (fait)                        |
| T45 | ~~§5.14 n'est pas couvert en entier~~ — **fait pour l'essentiel** (§8.1). Écran de paramètres livré : identité de l'édition, fenêtre d'inscription **réellement appliquée**, catégories et validation automatique, textes légaux renvoyés vers Contenus. Reste ouvert : l'**état des files de jobs**, seul point du §5.14 encore absent. Il n'est annoncé nulle part — aucun lien mort — mais BullMQ supprime les jobs terminés, si bien qu'un écran utile devrait s'appuyer sur `NotificationLog` et la table `Job` plutôt que sur la file elle-même. À décider avec T1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Basse     | §5.14                             |
| T46 | ~~Les permissions des rôles ne se modifient pas depuis l'écran~~ — **fait** (§8.2). `/admin/parametres/roles` édite `Role.permissions` par domaine, avec trois garde-fous : pas de modification de son propre rôle, pas de retrait de `users.manage` au dernier rôle actif qui le porte, et signalement à l'écran de toute permission absente du catalogue de libellés. La prise d'effet à la reconnexion (T13) est dite à l'écran plutôt que subie.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —         | §5.14                             |
| T47 | ~~Aucun test ne garantit qu'une entrée de menu mène quelque part~~ — **fait**. C'est ce qui avait laissé quatre 404 en place (§6 bis) : le menu était une liste écrite à la main que rien ne confrontait aux pages réellement présentes. La liste vit désormais dans `src/components/admin/nav.ts`, hors du composant — l'importer depuis le composant aurait entraîné `next/link` et un composant client dans le contexte Node de Playwright. Un test E2E **parcourt cette source** et exige un 200 sur chaque `href` : ajouter demain une entrée vers une page absente le fera échouer. Six tests unitaires complètent la garde : permissions issues du catalogue, aucune adresse en double, et le menu réellement obtenu par rôle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —         | §6 bis                            |
| T48 | **Les réglages d'apparence et de pied de page sont mis en cache soixante secondes** (§8.3, §8.6). C'est voulu — ils sont lus au rendu de chaque page — et l'action serveur invalide l'étiquette, si bien qu'un enregistrement paraît tout de suite. Mais une écriture faite **hors de cet écran** (script, base) mettra jusqu'à une minute à se voir, ce qui déroute quand on ne le sait pas. Les décisions, elles, ne passent pas par ce cache (`parametresFrais`). À redire au moment de la reprise en main par l'ANSD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Basse     | 8.3 (fait)                        |
| T49 | **Une seule page est composable** : l'accueil. Le catalogue et le modèle `PageSection` portent déjà une colonne `page`, et `PAGES` n'a qu'une entrée ; ouvrir « à propos » ou « infos pratiques » revient à ajouter une entrée et à brancher le rendu. Non fait faute de demande précise : ces pages tirent aujourd'hui leur contenu des blocs `ContentBlock`, et les basculer sans raison ferait perdre ce qui y est déjà saisi.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Basse     | 8.4 (fait)                        |
| T50 | **Les demandes de connexion consommées restent en base** (§23). `AdminLoginChallenge` ne se vide jamais : une demande utilisée ou expirée y reste, avec son code et l'adresse du poste. Sans conséquence pour la sécurité — ces codes ne valent plus rien — mais la table grossit d'une ligne par connexion d'administrateur. Les liens magiques des participants sont dans le même cas. Une purge commune (au-delà de 24 h) vaudrait mieux qu'un travail programmé pour chacune.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Basse     | 23                                |

---

## 6 bis. Administration (§5.14) et sponsors (§5.9) — **trou de planification comblé**

Signalé par l'utilisateur en essayant le BackOffice : quatre entrées du menu
renvoyaient une **404**. Ce n'était pas une régression mais un manque, et trois
des quatre écrans relevaient de lots que j'avais annoncés terminés.

| Entrée du menu         | Brief | Lot prévu | État constaté                                     |
| ---------------------- | ----- | --------- | ------------------------------------------------- |
| `/admin/utilisateurs`  | §5.14 | **Lot 0** | jamais écrit                                      |
| `/admin/audit`         | §5.14 | **Lot 0** | l'écriture existait, **la consultation non**      |
| `/admin/sponsors`      | §5.9  | **Lot 1** | page publique livrée, administration jamais faite |
| `/admin/contributions` | §5.10 | Lot 3     | hors périmètre à ce stade, à juste titre          |

La cause tient en une phrase : le menu était une liste écrite à la main, sans
rien qui vérifie que chaque entrée mène quelque part. Le §0.3 portait même déjà
la trace du premier manque — « politique de mot de passe non appliquée car aucun
écran de gestion des utilisateurs n'existe (Lot 1) » — et le Lot 1 est passé
sans l'écrire.

**Ce qui a été fait**

- `modules/users` — création de comptes, changement de rôle, activation, mot de
  passe (politique des 12 caractères du §7 enfin appliquée, tirage aléatoire
  dans le navigateur), détachement du 2FA pour téléphone perdu, déverrouillage.
  Trois garde-fous, tous testés : on ne change pas son propre rôle, on ne se
  désactive pas soi-même, et **le dernier compte actif portant `users.manage`
  ne peut être ni rétrogradé ni désactivé** — sans quoi plus personne ne
  rouvrirait cet écran. Un compte ne se supprime pas : `AuditLog.actorUserId`
  le référence, et effacer l'auteur d'une trace vide le journal de son sens.
- `modules/audit` — consultation filtrée (action, objet, auteur, période) et
  export CSV, comme le demande le §5.14. L'export est lui-même journalisé.
  `groupBy` plutôt que `distinct` pour les valeurs de filtre : Prisma
  dédoublonne `distinct` en mémoire après avoir rapatrié la table, qui grossit
  sans cesse.
- `modules/sponsors` — fiches, niveaux paramétrables, logos (type déduit des
  octets, servis par une route contrôlée qui refuse un logo non publié), retrait
  logique. La page publique affiche désormais logo, lien et stand ; sa requête
  est une projection explicite qui **exclut** les champs de contact interne.
- Le menu ne se contente plus d'être juste : chaque entrée porte la permission
  que sa page exige, et n'apparaît que si le rôle la détient. Un Lecteur voyait
  « Utilisateurs » puis se faisait renvoyer sans un mot.

Vérifié contre l'image Docker de production : 253 tests unitaires (+24) et
66 E2E (+5).

**Ce qui reste ouvert** — cf. T45 et T46.

---

## 7. Hors périmètre explicite de ce plan (rappel)

Le **Lot 2** est désormais découpé au §4 ci-dessus. Restent hors périmètre de ce document, en attendant leur échéance : **Lot 3** — Contributions & Actes, génération PDF des Actes, SMS réel (sous réserve d'un agrégateur, cf. C5), anonymisation automatique (où atterrit T26), et les corrections issues des tests du jour J.

## 8. Paramétrage du portail (demande du 8 septembre 2026)

Demande : rendre paramétrables les éditions et l'apparence du site, les dates et
règles d'inscription, les articles, le pied de page, et les rôles.

### Arbitrage préalable — C15 : jusqu'où va « paramétrable »

La demande dit « un template pour chaque type de section (boutons, couleurs,
polices, emplacement, animations) ». Prise au pied de la lettre, c'est un
constructeur de pages doublé d'un éditeur de design system. Deux objections, la
première dirimante :

1. **L'accessibilité cesserait d'être garantie.** Le 100/100 obtenu en Lot 1
   (T19, T34) repose sur des contrastes **calculés**, pas choisis à l'œil :
   `--text-3` remonté de 2,83:1 à 4,81:1, les boutons bleus de 4,14:1 à 7,01:1.
   Un sélecteur de couleurs libre laisse repasser sous 4,5:1 sans que rien ne le
   signale — sur un site institutionnel public, c'est une régression que la
   suite de tests ne rattrape pas aujourd'hui.
2. **« Emplacement » et « animations » libres, c'est un moteur de mise en page.**
   Pas un chantier : un produit. Et une grille librement déplaçable produit des
   pages cassées sur téléphone bien avant de produire des pages réussies.

**Retenu** : un **catalogue fermé de types de sections**, chacun offrant des
**variantes** de présentation vérifiées ; l'ordre, la visibilité et les réglages
de chaque section sont libres. Les couleurs sont libres **mais validées WCAG à
l'enregistrement** — sous 4,5:1 l'enregistrement est refusé et le ratio calculé
est affiché. Les polices viennent d'une liste courte, les animations d'une
énumération qui respecte `prefers-reduced-motion`.

Ce choix couvre l'intention — reprendre la main sur le contenu et l'apparence
sans passer par le code — et laisse la porte ouverte : ajouter un type de
section reste une entrée de catalogue.

### État de départ constaté

- `Edition.settings` (Json) et la table `Setting` **ne sont lues nulle part**.
- **L'ouverture et la fermeture des inscriptions n'existent pas** : la page
  publique est ouverte en permanence, quelle que soit la date.
- `ParticipantCategory.autoConfirm` est respecté par le service d'inscription
  mais **aucun écran ne permet de le changer** — les catégories sont figées au
  seed.
- La page d'accueil et le pied de page sont des compositions écrites à la main.
- `Post` n'a ni chapô ni galerie ; `coverPath` existe mais rien ne le remplit.

### 8.1 Paramètres de l'édition

- Réglages typés (zod) dans `Edition.settings`, plus les champs propres de
  l'édition : titre, thème, dates, lieu, ville.
- Ouverture et fermeture des inscriptions, **réellement appliquées** côté public
  et côté serveur — un réglage que rien ne lit est une décoration.
- Catégories de participants : libellés, couleur, ordre, activation, validation
  automatique, alerte au scan, logistique.
- Textes légaux : rattachés aux blocs `legal.*` existants.

### 8.2 Rôles ajustables (T46)

- Édition de `Role.permissions`, groupées par domaine et libellées.
- Garde-fou : impossible de retirer `users.manage` au dernier rôle qui le porte,
  ni de modifier son propre rôle. Prise d'effet à la reconnexion (T13), dit à
  l'écran.

### 8.3 Thème de l'édition

- Palette, police, rayon, intensité d'animation, stockés par édition.
- **Validation du contraste au moment d'enregistrer**, pas au moment de rendre.
- Injection en variables CSS dans le gabarit public, sans flash.

### 8.4 Sections de page

- Modèle `PageSection` : page, type, variante, ordre, visibilité, réglages,
  contenu FR/EN.
- Catalogue de types avec leurs variantes et leurs champs.
- Écran d'administration : ordonner, masquer, régler ; la page d'accueil rend
  ce catalogue au lieu d'une composition figée.

### 8.5 Articles enrichis

- Chapô, image de couverture, galerie, date de publication.

### 8.6 Pied de page paramétrable

- Colonnes de liens, réseaux sociaux, coordonnées, mentions.

---

### 8.7 Ce qui a été livré

**8.1 — Paramètres de l'édition.** `modules/settings` : titre, thème, dates,
lieu et ville ; fenêtre d'inscription (interrupteur immédiat + bornes de jours,
les deux **incluses**) ; catégories de participants (libellés, couleur, ordre,
activation, validation automatique, alerte au scan, logistique). Les textes
légaux restent dans les blocs `legal.*`, sous Contenus.

L'essentiel n'est pas l'écran mais son effet : `Edition.settings` et la table
`Setting` n'étaient **lues nulle part**, et l'ouverture des inscriptions
n'existait pas. La fenêtre est désormais appliquée dans
`registerPublicParticipant`, pas seulement à l'affichage — masquer un formulaire
n'empêche personne de reposter la requête. Deux exceptions, assumées et testées :
une **invitation nominative** reste valable hors fenêtre (c'est le comité qui
l'a émise et qui fixe les dates), et le comptoir d'accueil n'est jamais bloqué.

Le chemin d'écriture lit les réglages **sans cache** (`parametresFrais`) : un
cache de soixante secondes convient à une couleur, pas à une règle — laisser
passer une inscription une minute après la fermeture n'est pas un délai
d'affichage.

**8.2 — Rôles ajustables (T46 levé).** Édition de `Role.permissions` par
domaine, avec catalogue libellé. Trois garde-fous : on ne modifie pas les droits
de son propre rôle (ils ne prendraient effet qu'à la reconnexion, T13, et
l'écran afficherait entre-temps des droits perdus) ; on ne retire pas
`users.manage` au dernier rôle actif qui le porte ; une permission absente du
catalogue est signalée à l'écran plutôt que silencieusement inaccordable.

**8.3 — Apparence.** Couleurs, police, arrondi, animations, par édition,
injectées en variables CSS dans le gabarit racine. Les couleurs sont **libres
mais vérifiées à l'enregistrement** : sous 4,5:1 avec leur texte (calculé, pas
choisi), c'est refusé, avec le ratio et la teinte conforme la plus proche. La
couleur d'accent relève du seuil non textuel de 3:1 sur les **deux** fonds de
thème — elle dessine le contour de focus au clavier.

Les polices sont servies par `next/font` avec `preload: false` : seule celle qui
est choisie est téléchargée. Les titres gardent la police d'affichage de la
charte — la changer ne serait plus un réglage mais une refonte.

**8.4 — Sections de page.** Modèle `PageSection`, catalogue de huit types
(bandeau, texte, chiffres clés, actualités, programme, intervenants,
partenaires, appel à l'action), chacun avec ses variantes vérifiées, ses champs
bilingues et ses réglages. Ordre par échange de rangs (deux boutons, utilisables
au clavier et sur téléphone — même raisonnement que T43), visibilité, ajout et
retrait. La page d'accueil se compose à partir de ces sections ; **tant
qu'aucune n'existe**, elle rend sa composition d'origine, par les mêmes
composants de rendu — deux rendus parallèles auraient divergé au premier
ajustement.

Les données des sections sont chargées en **une passe** : l'union de ce que les
sections visibles réclament, et non une requête par section.

**8.5 — Articles enrichis.** Chapô (utilisé par la liste et par les aperçus
partagés — le corps tronqué à 160 signes coupait au milieu d'un mot), image de
couverture, galerie légendée. Les images sont désignées par « couverture » ou
par leur rang, jamais par un chemin de fichier venu du navigateur.

**8.6 — Pied de page.** Organisation, adresse, courriel, téléphone, mention
légale, réseaux sociaux et liens supplémentaires. Les trois libellés de réseaux
sans lien qui traînaient depuis le Lot 1 ont disparu.

### 8.8 Défauts d'accessibilité trouvés en construisant le contrôle de contraste

Construire un validateur de couleurs revenait à mesurer la palette existante.
Six jetons étaient sous leur seuil, tous invisibles jusqu'ici — l'audit
Lighthouse (T19) tournait en thème sombre, où plusieurs suivent le motif
inverse et passent, et aucun outil n'audite le contraste d'un contour de focus.
Valeurs **calculées**, avant → après :

| Jeton                    | Usage                               | Avant  | Après                               |
| ------------------------ | ----------------------------------- | ------ | ----------------------------------- |
| `--primary` (clair)      | bouton « S'inscrire »               | 4,38:1 | **4,84:1**                          |
| `--ansd-or`              | contour de focus clavier, sur blanc | 2,08:1 | **3,36:1** (5,00:1 sur fond sombre) |
| `--accent-text` (clair)  | pastille « Confirmé »               | 3,82:1 | **4,56:1**                          |
| `--warn-text` (clair)    | pastille « En attente »             | 2,69:1 | **4,58:1**                          |
| `--danger-text` (clair)  | pastille « Annulé »                 | 4,45:1 | **4,60:1**                          |
| `--gold-text` (clair)    | pastille « Badgé »                  | 4,14:1 | **4,58:1**                          |
| `--danger-text` (sombre) | pastille « Annulé »                 | 3,70:1 | **4,55:1**                          |

`src/app/palette.test.ts` lit désormais `globals.css` et vérifie chaque couple
dans les deux thèmes, contour de focus compris. La classe de défaut est fermée :
une couleur remise sous le seuil fait échouer la suite.

---

## 9. Interface du BackOffice (demande du 8 septembre 2026)

Demande : menu repliable et en rubriques dépliables, icônes sur les entrées et
sur les boutons, pastille utilisateur cliquable ouvrant la déconnexion,
confirmation SweetAlert2, indicateurs du tableau de bord plus vivants,
animations au survol, esthétique d'ensemble.

### 9.1 Deux dépendances ajoutées

`lucide-react` (icônes, MIT, importées une par une donc élaguées à la
compilation) et `sweetalert2` (boîtes de confirmation, demandée nommément).

SweetAlert2 est habillé aux **jetons du thème** (`globals.css`, classe
`.forum-swal`) : ses couleurs par défaut ignorent le thème sombre, et une boîte
blanche sur un BackOffice sombre se remarque plus qu'elle ne rassure.

### 9.2 Les confirmations natives ont toutes été remplacées

La demande ne visait que la déconnexion. Ne traiter qu'elle aurait laissé onze
`window.confirm` natifs sur « Supprimer » et « Retirer » — précisément ce qui ne
fait pas « premium », et une incohérence visible d'un écran à l'autre. Les onze
sont passées sur la même boîte, avec, à chaque fois, un texte qui dit **la
conséquence** plutôt que de répéter la question :

> « Aucun nouveau badge ne sera émis : le QR cesse immédiatement d'être valide
> et la personne se verra refuser l'accès à tous les points de contrôle. »

Une douzième a été ajoutée là où elle manquait : **révoquer un badge sans le
réémettre**, qui laisse quelqu'un sans accès le jour J, partait jusqu'ici sur un
simple clic.

Conséquence sur les tests : six assertions interceptaient la boîte native par
`page.once("dialog", …)`. SweetAlert2 est du DOM ordinaire ; elles passent par
`e2e/helpers/dialogue.ts`, qui clique le bouton **et attend la disparition de la
boîte** — sans cette attente, l'assertion suivante partait pendant l'animation
de fermeture et lisait encore l'ancien état.

### 9.3 Menu repliable et rubriques dépliables

État — menu réduit, rubriques fermées — persisté en cookie et **lu par le
serveur**, pour que le premier rendu soit déjà dans le bon état.

Deux choix qui ne se voient pas mais qui comptent :

- **La rubrique contenant la page courante reste dépliée**, quel que soit le
  cookie. Se retrouver sur un écran dont l'entrée de menu a disparu fait perdre
  le fil de l'endroit où l'on est.
- **Le cookie est écrit par le navigateur, pas par une Server Action.** Le motif
  du sélecteur de thème (état local immédiat, écriture serveur en arrière-plan)
  laisse une fenêtre pendant laquelle le cookie n'est pas encore à jour :
  replier le menu puis cliquer aussitôt sur un lien rouvrait le menu. Défaut
  constaté en test de bout en bout, pas supposé. Une écriture synchrone dans
  `document.cookie` supprime la course — et un aller-retour serveur pour une
  préférence d'affichage.

Replié, le menu garde les libellés en infobulle et en nom accessible : une
icône seule n'aide personne à la première visite.

### 9.4 Icônes

Chaque entrée de menu et chaque bouton nommé porte la sienne. Elles sont
**décoratives** (`aria-hidden`) : le nom accessible reste le texte, et rien ne
dépend de la seule icône. L'entrée active est signalée par un liseré vertical en
plus de la couleur — un état porté par la seule teinte échappe à qui la
distingue mal.

Les classes des boutons étaient recopiées à la main dans une trentaine de
fichiers et avaient commencé à diverger (arrondis, hauteurs, survols). Elles sont
regroupées dans `components/ui/bouton.tsx`, en quatre tons.

### 9.5 Animations

Toutes passent par `--duree-animation`, **mise à 0 sous
`prefers-reduced-motion`**, avec un filet qui neutralise aussi ce qui
n'utiliserait pas la variable. Un seul endroit à couper : une transition écrite
en dur ailleurs échapperait au réglage, et la préférence système ne serait
respectée qu'à moitié.

### 9.6 Indicateurs du tableau de bord

Icône, couleur de ton, filet coloré, léger relief au survol, apparition
décalée (plafonnée à huit pas : au-delà, l'attente se remarque).

Les couleurs reprennent les couples adouci/texte **déjà vérifiés** par
`palette.test.ts` au lieu d'introduire de nouvelles teintes. La couleur ne porte
aucune information à elle seule : le libellé dit tout, elle ne fait que
regrouper.

---

### 9.7 Boutons : icônes partout, icône seule pour les actions de ligne

Deuxième passe, après retour sur captures d'écran.

**Les quatre actions de ligne des sessions** — Inscriptions, Publier/Dépublier,
Dupliquer, Supprimer — sont réduites à leur icône. Elles occupaient le tiers de
la largeur du tableau, sur trois lignes par rangée, et repoussaient le titre des
sessions.

Le nom accessible est porté par **`aria-label` autant que par `title`**. `title`
seul ne nomme pas fiablement un élément : sa restitution varie d'un lecteur
d'écran à l'autre, et il n'apparaît jamais au clavier sans survol. Bénéfice
secondaire : le nom accessible reste « Supprimer », donc les tests de bout en
bout qui interrogent les boutons par leur nom continuent de fonctionner sans
retouche.

**Les autres boutons** ont reçu leur icône. La conversion a été faite par un
codemod (`scratchpad/codemod.mjs`, non versionné) qui repère la balise ouvrante
en suivant accolades et guillemets — une expression régulière s'arrêterait au
premier « > », qui se trouve au milieu de chaque `onClick={() => …}`. 43 boutons
convertis d'un coup, 11 traités à la main.

Trois icônes choisies par le codemod étaient fausses et ont été corrigées : il
lisait l'état de chargement (« Envoi… ») plutôt que l'action, et donnait `Send`
à des téléversements. Une quatrième, sur « Marquer présent », suivait le mot
« retirer » de la branche voisine ; elle suit désormais le sens de l'action.

Hors périmètre, volontairement : les écrans publics et participants (formulaire
d'inscription, espace intervenant, scanner). La demande portait sur le
BackOffice, et le scanner en particulier a une ergonomie propre, pensée pour le
plein soleil et une seule main.

**Défaut de méthode à noter.** La construction de l'image avait échoué et je ne
l'ai pas vu : je n'avais lu que les deux dernières lignes de sa sortie, où
figure une adresse de journal identique en cas de succès comme d'échec. Le test
qui a suivi tournait donc contre une image antérieure, et son échec ne disait
rien du code. Comparer la date de l'image à celle des sources l'a montré en une
commande — contrôle à faire systématiquement avant d'accuser un test.

### 8.9 Défaut corrigé — ajouter une section effaçait la page d'accueil

Constaté sur l'instance de démonstration : l'accueil ne montrait plus qu'un
encart « Rejoignez le Forum », le reste avait disparu.

**Cause.** Le rendu bascule sur les sections enregistrées **dès qu'il en existe
une**. La composition d'origine — bandeau, texte d'introduction, actualités —
n'était qu'un repli, jamais écrit en base. La toute première section ajoutée la
remplaçait donc entièrement. Le déclencheur immédiat était une section créée par
un test de bout en bout, mais n'importe qui ajoutant une section pour l'essayer
aurait vidé la page publique de la même façon.

**Correction.** `creerSection` **matérialise la composition d'origine en base**
avant d'insérer la première section d'une page. Reprendre la main veut désormais
dire « la page devient modifiable », et non « la page est vidée » : les trois
sections d'origine apparaissent dans l'écran, réordonnables et masquables.

La composition vit maintenant dans `modules/sections/defaut.ts`, en **données**
plutôt qu'en JSX, pour servir les deux usages depuis une seule définition : le
repli tant qu'aucune section n'existe, et la matérialisation.

Les textes sont figés au moment de la matérialisation. Ils viennent des blocs
éditoriaux, qui restent modifiables sous Contenus, mais la section porte ensuite
sa propre copie — c'est le prix de la reprise en main, et cela évite que le
contenu change sous les yeux de qui vient de le reprendre.

**Le test qui a révélé le défaut le verrouille désormais** : après ajout d'une
première section, il vérifie que l'écran en porte quatre — les trois d'origine
plus la sienne — et que l'accueil affiche toujours les actualités. Son nettoyage
efface toutes les sections de la page, et non la seule qu'il avait créée.

### 8.10 Test de sections rendu indépendant de l'état antérieur

Le test de la §8.9 a échoué une fois : il attendait quatre cartes, en a compté
cinq. Aucun défaut du produit — la suite précédente avait été **tuée en cours
d'exécution** (arrêt des conteneurs), son nettoyage de fin n'était donc jamais
passé, et quatre sections étaient restées en base. L'exécution suivante n'a pas
déclenché la matérialisation, puisque la page n'était plus vide, et l'ajout a
porté le total à cinq.

Le nettoyage se fait désormais **avant autant qu'après**. Un `afterAll` ne
s'exécute pas quand le processus est interrompu : un test qui affirme un nombre
exact doit garantir son point de départ, pas l'espérer.

## 10. Habillage du site public (demande du 9 septembre 2026)

Demande : rendre le site du Forum « premium » — couleurs, animations surtout sur
l'accueil, cartes améliorées, icônes sur les boutons, revue de toutes les pages.

### 10.1 Fondations partagées

Trois ajouts, pour que les pages cessent d'être une suite d'écrans sans parenté :

- **`EnteteSection`** — sur-titre, titre, description, icône, action à droite.
  Le paramètre `niveau` existe parce que la hiérarchie des titres est
  sémantique : l'accueil porte son `h1` dans le bandeau, ses sections sont en
  `h2` ; une page intérieure ouvre en `h1`.
- **`Reveal`** — apparition au défilement.
- **Utilitaires CSS** : fond de bandeau à halos, filet coloré, vignette à cadre
  stable, carte-lien qui se soulève.

Toutes les transitions passent par `--duree-animation`, mise à zéro sous
`prefers-reduced-motion` par le bloc du BackOffice : un seul interrupteur pour
tout le site.

### 10.2 Deux défauts introduits, tous deux attrapés par un test

**Du contenu invisible.** L'apparition au défilement, écrite naïvement, laissait
masqué tout ce qui avait été **dépassé** sans croiser la fenêtre : arrivée sur
une ancre, position restaurée au rechargement, molette rapide. Le test le montre
en sautant au bas de page — quatre sections restaient invisibles. Corrigé par
une marge haute immense sur l'observateur : ce qui est au-dessus de la fenêtre
compte comme visible et se révèle aussitôt.

Deuxième précaution, prise dès l'écriture : l'état de départ n'est posé que
**par le script**. Une page servie sans JavaScript affiche son contenu au lieu
de le laisser transparent.

**Titres illisibles en thème sombre.** Défaut plus ancien, introduit au §8.3 et
révélé ici par l'audit. L'injection de thème disait :

```css
:root:not([data-theme="dark"]) {
  --heading: <couleur secondaire>;
}
```

Ce sélecteur n'exclut que le thème sombre **choisi explicitement**. L'attribut
étant absent par défaut, tout visiteur dont le système est en sombre et qui n'a
jamais touché l'interrupteur — le cas le plus courant — recevait un titre bleu
foncé sur fond bleu nuit : **1,7:1 mesuré**. Cela expliquait les intitulés
délavés du pied de page.

Corrigé en visant les deux situations où le clair s'applique réellement : le
choix explicite, et l'absence de choix sur un système clair. Un test sur la
fonction pure interdit la reprise du défaut.

### 10.3 Vérification

`pnpm audit:lighthouse` sur les sept pages publiques : **accessibilité 100
partout**, SEO 100, bonnes pratiques 100. La performance reste entre 83 et 95,
avec la réserve déjà connue sur l'accueil (T19).

À noter pour les prochains audits : après une série d'exécutions, des instances
Chrome headless s'accumulent et font échouer les suivantes sans rapport avec le
code. Deux pages ont ainsi paru « non auditables » avant qu'un nettoyage des
seuls processus `--headless` ne les rende à 100.

### 10.4 Seconde passe : les pages restantes

La première passe avait traité l'accueil et cinq pages de rubrique. La demande
portait sur **toutes** les pages : les dix restantes sont reprises ici, plus
l'en-tête, le pied de page et les composants de formulaire.

Deux briques ont été extraites plutôt que recopiées une dixième fois :

- **`BandeauPage` / `CorpsPage`** — le seuil de page et sa colonne de contenu.
  La largeur est un choix éditorial (`large` 1200 px pour les grilles, `moyen`
  900 px, `etroit` 720 px pour le texte suivi), et le bandeau reprend celle du
  contenu qu'il annonce, sinon le titre flotte au-dessus d'une colonne décalée.
- **`BoutonSite` / `LienSite` / `LienSiteExterne`** — le bouton du site public,
  distinct de celui du BackOffice : plus grand, plus arrondi, un léger
  soulèvement au survol. Un visiteur passe quelques minutes sur le site, un
  agent y passe sa journée. `iconeDeLien` y déduit l'icône de la destination,
  et le rendu des sections d'accueil s'appuie désormais sur les mêmes classes
  au lieu d'en garder une copie.

**Réserve assumée sur les réseaux sociaux.** lucide a retiré ses pictogrammes de
marque en version 1. Les redessiner de mémoire donnerait des logos approximatifs
— pire que pas de logo. Chaque réseau reçoit donc une icône qui décrit le
_média_ (réseau professionnel, poignée, communauté, vidéo, photo, site) et le
nom du réseau reste écrit à côté : rien ne repose sur l'icône. À remplacer par
les vraies marques si l'ANSD fournit un jeu d'icônes.

**Deux glyphes typographiques remplacés.** Le « ☰ » du menu mobile, le « ▼ » du
menu déroulant et le « ☀ / ☾ » du thème se rendaient avec la police du texte :
leur taille et leur alignement changeaient donc selon la police choisie en
BackOffice (§8.3). Trois icônes vectorielles à la place.

**Lien d'évitement** ajouté au gabarit public (WCAG 2.4.1). L'en-tête est
collant et porte jusqu'à une douzaine de liens ; sans ce raccourci, atteindre le
contenu au clavier demandait de tous les traverser, sur chaque page.

### 10.5 Un défaut silencieux, rencontré deux fois

Deux utilitaires Tailwind pour une même propriété CSS, dans un même attribut :
`inline-flex block` sur un lien du pied de page, puis `py-14 py-16` quand une
page passait son rythme vertical par `className` à un composant qui en posait
déjà un.

Ce défaut est invisible à la relecture et silencieux à l'exécution. Ce n'est pas
l'ordre de l'attribut qui tranche, mais celui des règles dans la feuille de
style générée : le résultat est donc juste sur une page et faux sur une autre,
sans rien dans la console. Ni TypeScript ni ESLint ne le voient.

Deux réponses :

1. `CorpsPage` n'accepte plus une classe de padding libre. Le rythme vertical
   est un choix parmi trois (`compact`, `normal`, `ample`). Un menu fermé évite
   le piège au lieu de compter sur la vigilance.
2. `src/app/classes-tailwind.test.ts` lit les sources du site et refuse deux
   jetons de la même famille **sous le même variant**. La précision compte :
   `hidden xl:inline-flex` est le motif normal du responsive et reste permis,
   parce que les deux règles ne s'appliquent jamais au même moment. Le test
   vérifie aussi qu'il sait détecter un conflit, sinon un test qui ne trouve
   rien pourrait aussi bien ne rien chercher.

### 10.6 Le script Lighthouse jugeait sur le mauvais signal

L'audit s'est mis à échouer sur toutes les pages. La cause n'était pas le code
mesuré : sous Windows, Lighthouse écrit son rapport **puis** efface le profil
Chrome temporaire qu'il s'est créé, et cette suppression échoue par
intermittence en `EBUSY` — le processus Chrome n'a pas encore rendu ses
fichiers. Le script mourait donc sur un nettoyage raté, alors que la mesure
était faite et écrite sur disque.

Corrigé en jugeant sur le rapport et non sur le code de sortie : si le fichier
est absent, l'audit a réellement échoué et l'erreur repart ; s'il est là, on le
lit.

À noter, parce que cela s'est reproduit : la tâche de fond a rapporté « exit
code 0 » alors que la commande avait échoué. C'est la raison pour laquelle le
§9.7 impose de lire le journal entier et non ses dernières lignes.

### 10.7 Deux défauts de fond, invisibles au code

Les captures envoyées le 9 septembre montraient des pages restées ternes malgré
les bandeaux : titres sans relief, intitulés de colonnes délavés dans le pied de
page. La cause n'était dans aucune page.

**Aucune taille de titre.** Le `preflight` de Tailwind ramène `h1`…`h4` à la
taille et à la graisse du texte courant, et `globals.css` ne définissait que la
famille, l'interlignage et la couleur. Chaque `h1` du site s'affichait donc à
**16 px en graisse 400** — mesuré dans le navigateur. Aucune page n'avait de
hiérarchie visuelle, quel que soit le soin mis aux bandeaux. Une échelle fluide
est posée pour les quatre niveaux.

Le risque de régression était faible et il a été mesuré avant d'agir : le
BackOffice n'a **aucun** titre sans classe de taille, le site public en a
treize. L'échelle ne pouvait donc toucher que les pages visées.

**Les règles de base battaient les utilitaires.** Tailwind v4 place ses
utilitaires dans `@layer utilities`. Dans la cascade CSS, **une règle hors
calque l'emporte sur toute règle en calque**, quelle que soit sa spécificité.
Les règles d'élément de `globals.css`, écrites hors calque, gagnaient donc
contre chaque `text-*` posé sur un titre.

Conséquence mesurée : le `<h2 className="text-white">` des colonnes du pied de
page restait à `#0b4f8a` sur le bandeau `#082c4e`, soit **1,69:1**. La classe
était bien présente dans le JSX ; elle perdait ailleurs. C'est ce que montraient
les captures, et c'est un défaut qu'aucune relecture du composant ne pouvait
attraper.

Corrigé en plaçant `body`, les titres et `:focus-visible` dans `@layer base`.
Vérification préalable qu'aucun `outline-none` n'existe dans les sources : le
contour de focus, désormais surchargeable, aurait pu disparaître silencieusement.
Trois assertions dans `palette.test.ts` interdisent le retour en arrière.

### 10.8 Méthode : `docker restart` ne reprend pas une image reconstruite

Une première série de vérifications a porté sur l'ancien code sans que rien ne
le signale. L'image avait bien été reconstruite, le conteneur bien redémarré —
mais `docker restart` relance le conteneur **sur son image d'origine**. Les
captures et l'audit Lighthouse décrivaient donc l'état d'avant.

Contrôle à faire systématiquement, au même titre que la lecture du journal de
construction (§9.7) :

```
docker image inspect forum-ansd:local --format "{{.Id}}"
docker inspect forum-ansd-app        --format "{{.Image}}"
```

Les deux doivent être identiques. Sinon, il faut **recréer** le conteneur
(`docker rm -f` puis `docker run`), pas le redémarrer.

### 10.9 L'audit groupé mesurait la machine, pas le site

Après la reconstruction, l'audit des onze pages publiques rendait des scores de
performance de 73 à 88, là où les mêmes pages tenaient 83 à 95 auparavant. La
chute était uniforme, y compris sur les pages les plus simples : le signe d'une
cause commune, pas d'une régression de rendu.

Mesure isolée, même image, mêmes pages :

| Page             | En série | Isolément |
| ---------------- | -------- | --------- |
| `/contributions` | 73       | **91**    |
| `/verifier`      | 73       | **90**    |
| `/`              | 87       | **92**    |

La cause : Lighthouse ferme son navigateur mais laisse des processus enfants
`--headless` derrière lui. Sur onze pages en trois exécutions, trente-trois
lancements s'accumulent, et Lighthouse mesure aussi la charge de la machine.
L'audit décrivait donc l'encombrement du poste.

C'était déjà connu (§10.3) mais traité comme un geste manuel à répéter. Le
nettoyage est désormais **dans le script**, entre chaque page, et ne vise que
les processus portant `--headless` — le navigateur de la personne qui lance
l'audit reste ouvert.

Leçon générale : une mesure qui se dégrade uniformément sur tout un ensemble
accuse d'abord l'instrument.

### 10.10 Une icône ne remplace pas un mot

La suite E2E a rattrapé une régression que les captures ne montraient pas : la
carte partenaire affichait « A12 » au lieu de « Stand A12 ». En remplaçant le
libellé par une pastille verte à icône de boutique, j'avais supprimé le seul
élément qui disait de quoi il s'agissait.

Le test attendait `Stand A12` ; corrigé **dans la page**, pas dans le test.
L'icône reste, mais elle appuie le mot au lieu de s'y substituer — c'est la même
règle que pour les états de session du programme (§10.7) et les filtres actifs
(la coche à côté de la couleur) : rien d'informatif ne doit reposer sur le seul
pictogramme.

Résultat de la suite avant correction : **80 passés, 1 échec** en 9,8 minutes.

### 10.11 Ce que l'audit de performance peut et ne peut pas dire ici

J'ai cru lire une régression : `/sponsors` mesuré à 95 avant l'habillage, 75
après. J'en ai déduit que le motif « un `Reveal` par carte » coûtait cher, et
j'ai refait la page en conséquence.

La mesure suivante a démenti le raisonnement. Sur du code **identique**, à
quelques minutes d'intervalle, même image, même machine :

| Page         | Mesure 1 | Mesure 2 |
| ------------ | -------- | -------- |
| `/programme` | 95       | 87       |
| `/sponsors`  | 57       | 90       |

`/programme` n'avait pas été touché entre les deux. L'écart de l'instrument sur
ce poste est de l'ordre de **±20 points**, avec préchauffage, nettoyage des
processus Chrome et vingt secondes de repos entre deux mesures.

Conclusion, à retenir pour la suite :

- **Accessibilité, SEO et bonnes pratiques sont exploitables.** Ces trois scores
  sont donnés à 100 par toutes les exécutions, sans exception. Ils ne dépendent
  pas du temps.
- **La performance ne l'est pas sur ce poste.** Aucune décision ne doit être
  prise sur une mesure isolée. Le brief demande ≥ 90 (§3.2) : ce contrôle devra
  se faire sur une machine dédiée ou en intégration continue, pas ici.
- Ma déduction initiale était donc non fondée, et je l'ai écrite ici plutôt que
  de la laisser passer pour un fait.

### 10.12 `RevealListe` : gardé pour sa structure, pas pour un chiffre

Le changement fait à tort — un observateur par grille au lieu d'un par carte —
est conservé, mais pour une raison qui se défend sans mesure : `Reveal` posé sur
chaque élément crée **une frontière client par carte**. Dix partenaires, dix
composants à hydrater, dix `IntersectionObserver`. `RevealListe` n'en crée
qu'un, et l'échelonnement des cartes passe en CSS, qui n'a rien à hydrater.

Le rendu est identique — vérifié à l'écran et par un contrôle programmatique :
aucun élément à opacité nulle après défilement.

Le défaut de contenu invisible ayant désormais **deux implantations**, le test
qui le ferme en couvre deux aussi : `e2e/apparence.spec.ts` vérifie
`data-revele` sur l'accueil et `data-revele-liste` sur les partenaires. Un test
qui ne surveillerait que le premier attribut laisserait le second libre de
reproduire le défaut.

### 10.13 Vérification finale du lot 10

| Contrôle                           | Résultat                       |
| ---------------------------------- | ------------------------------ |
| Tests unitaires                    | **324 passés**                 |
| Suite E2E complète                 | **81 passés**, 12,4 min        |
| Accessibilité Lighthouse, 11 pages | **100 partout**                |
| SEO · bonnes pratiques             | 100 · 100                      |
| Performance                        | non concluante ici, cf. §10.11 |
| Typage, lint                       | propres                        |

## 11. Le logo de partenaire refusait le format des logos (10 septembre 2026)

Signalé : « j'ai ajouté un logo pour la Banque mondiale mais ça ne s'affiche pas
une fois publié ».

### 11.1 Diagnostic

Le champ `logoPath` du partenaire était resté **NULL** en base, et le journal
d'audit ne portait aucune entrée `sponsor.logo_updated`. Le fichier n'avait donc
jamais atteint le service : le défaut était au dépôt, pas à l'affichage.

Reproduit en pilotant l'interface réelle :

| Format déposé | Résultat                                                   |
| ------------- | ---------------------------------------------------------- |
| SVG           | refusé, « Format d'image non reconnu (JPEG, PNG ou WebP) » |
| PNG           | accepté, aperçu affiché, `logoPath` renseigné              |

La cause est donc le format. Or un logo institutionnel est presque toujours
livré en vectoriel : la Banque mondiale, la BAD, l'Union européenne publient
toutes leur logo en SVG. Une fonction « logo de partenaire » qui refuse le SVG
refuse le cas normal.

Deux défauts se cumulaient :

1. **Le format le plus courant n'était pas accepté.**
2. **Le refus était presque invisible.** Le message s'affichait en texte nu, en
   bas d'un panneau latéral étroit, entre l'aide de saisie et le bouton
   « Retirer ce sponsor ». L'agent voyait la page ne pas changer et concluait
   que rien ne s'était produit.

### 11.2 Accepter le SVG sans ouvrir une porte

Un SVG est un document XML, pas un bitmap : il peut porter du script, appeler
des ressources distantes, ou déclarer des entités qui font exploser
l'analyseur. C'est la raison pour laquelle il avait été écarté, et cette raison
était bonne. Elle se traite plutôt qu'elle ne se subit.

**Ce qui a été fait :**

- `src/modules/sponsors/logo.ts` — détection propre aux logos, **séparée** de
  `detectImageType`, qui sert aussi aux photos de participants et aux badges.
  Le SVG est accepté ici et nulle part ailleurs.
- Une liste de refus explicite plutôt qu'un assainisseur. Un assainisseur
  réécrit le fichier et laisse croire que tout est passé, alors qu'un logo
  amputé de la moitié de ses balises est un défaut découvert bien plus tard.
  Ici le fichier douteux est refusé, et l'agent lit pourquoi.
- Sont refusés : `<script>`, `<foreignObject>`, `<iframe>`/`<embed>`/`<object>`,
  les entités XML et les DOCTYPE à sous-ensemble interne, tout attribut
  `on…=`, les URL `javascript:` et `data:text/html`, et toute référence
  externe. Les références **internes** (`href="#degrade"`) restent permises :
  ce sont elles qui portent les dégradés et les masques.
- La route de service ajoute son durcissement : `Content-Security-Policy`
  interdisant toute ressource et plaçant le document en bac à sable,
  `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`.

Le raisonnement de fond, à garder en tête si ce code est repris : chargé par
`<img src>` — le seul usage qu'en fait le portail — un SVG **n'exécute aucun
script**, dans tous les navigateurs modernes. Le risque tient à la navigation
directe vers l'URL du fichier, où il devient un document à part entière. C'est
ce cas précis que les en-têtes ferment.

### 11.3 Rendre le refus visible

Le retour de l'action est désormais encadré, coloré et porte une icône, avec
`role="status"` pour que les lecteurs d'écran l'annoncent sans voler le focus.
L'aide de saisie annonce les quatre formats et recommande le SVG.

### 11.4 Un défaut trouvé par le test qu'il fallait écrire

Le validateur est du code de sécurité : il est arrivé avec ses tests, et le
premier passage en a révélé un défaut réel. `detectImageType` renvoie **l'entrée
complète de sa table de signatures**, fonction de test comprise ; la diffuser
par `...` faisait voyager cette fonction dans l'objet résultat. Le type déclaré
la masquait, TypeScript ne voyait rien. Elle se serait manifestée le jour où ce
résultat aurait traversé une frontière serveur/client. Les champs sont
maintenant recopiés un par un.

### 11.5 Le test a trouvé un défaut de sécurité que je n'avais pas vu

La route posait sa propre politique de sécurité, plus stricte. Le test l'a lue
sur le fil et a trouvé **celle du site** à la place :

```
default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic' https: 'unsafe-inline'; …
```

Le middleware s'exécute **avant** la route et ses en-têtes l'emportent. Un SVG
déposé par un tiers et ouvert en navigation directe se serait donc trouvé sous
une politique autorisant `script-src 'self'` et `'unsafe-inline'`.

Ma première correction a été mauvaise : conserver la politique si la réponse en
portait déjà une. Elle ne pouvait pas fonctionner, le middleware n'ayant jamais
la réponse de la route sous les yeux. Le test l'a rejetée aussi.

La correction juste place la décision là où elle se prend : le middleware
reconnaît la route au chemin et lui applique
`default-src 'none'; sandbox; base-uri 'none'; form-action 'none'`. La route ne
garde que les deux en-têtes qui décrivent le fichier, `nosniff` et
`Content-Disposition`.

Les autres routes de fichiers restent volontairement sous la politique du site :
photos, images d'article et badges passent par `detectImageType`, qui n'accepte
que JPEG, PNG et WebP, aucun format porteur de script. Le PDF des badges est
laissé tel quel, `sandbox` empêchant son affichage par la visionneuse intégrée.

### 11.6 Vérification

- `src/modules/sponsors/logo.test.ts` — **20 tests**, dont dix formes d'attaque
  connues, chacune refusée avec sa raison.
- `e2e/sponsors-logo.spec.ts` — le parcours réel : un SVG piégé est refusé avec
  sa raison affichée ; un SVG propre est accepté, enregistré, servi avec ses
  en-têtes de durcissement, et apparaît sur la page publique à la place du nom.

**Note d'exploitation.** Le diagnostic a déposé puis retiré un PNG d'un pixel
sur la fiche de la Banque mondiale. Le champ a été remis à vide et le fichier
supprimé du stockage. Les deux entrées `sponsor.logo_updated` du 10 septembre
restent au journal d'audit : il est en ajout seul, et c'est très bien ainsi.

### 11.7 La vraie cause : deux formulaires, un seul bouton visible

Mon diagnostic du §11.1 était juste sur les faits et **faux sur la cause**. Les
captures envoyées par l'utilisateur l'ont montré : le fichier était un `.jpg`,
format accepté depuis toujours, et le message affiché à l'écran disait
« **Sponsor enregistré** », pas « Logo enregistré ».

Le journal d'audit confirme, à la seconde près :

| Heure    | Action                 | Cible                      |
| -------- | ---------------------- | -------------------------- |
| 15:19:17 | `sponsor.updated`      | Banque mondiale            |
| 15:15:53 | `sponsor.logo_updated` | AFRISTAT (test automatisé) |
| 15:24:21 | `sponsor.logo_updated` | AFRISTAT (test automatisé) |

Aucun envoi de logo sur la Banque mondiale. L'utilisateur avait choisi le
fichier dans le panneau de droite, puis cliqué sur « Enregistrer » — le bouton
visible en bas de la fiche. Ce bouton appartient au **formulaire du sponsor** ;
celui du logo est un formulaire distinct, avec son propre bouton
« Téléverser » dans le panneau latéral. Le fichier restait donc sur place, et
le champ se vidait au rafraîchissement.

C'est un défaut d'agencement, pas de code : deux formulaires côte à côte, un
seul bouton qui ressemble à l'action principale.

**Correction.** Le fichier part **dès qu'il est choisi**. Choisir un fichier est
l'intention de l'envoyer ; il n'y a plus de second geste à ne pas oublier. Le
bouton « Téléverser » demeure, pour réessayer et pour le cas sans JavaScript,
mais il n'est plus le seul chemin. Le champ est vidé après un envoi réussi, pour
qu'un nom de fichier affiché à côté d'un aperçu à jour ne laisse pas croire
qu'il reste quelque chose à faire.

Le test correspondant n'appuie sur **aucun** bouton après le choix du fichier :
si l'envoi automatique disparaissait, il échouerait aussitôt.

**Ce que je retiens sur la méthode.** J'avais une hypothèse plausible — le SVG,
format habituel des logos institutionnels — et je l'ai traitée comme établie
alors que je n'avais jamais vu le fichier de l'utilisateur. Le journal d'audit
contenait déjà la réponse : une entrée `sponsor.updated` sans
`sponsor.logo_updated` désigne un formulaire soumis à la place de l'autre, pas
un format refusé. Le support SVG ajouté au §11.2 reste utile et correct, mais il
ne réglait pas ce problème-là.

## 12. « À propos » absorbée par la page d'accueil (10 septembre 2026)

Demande : déplacer le contenu de la page « À propos » dans l'accueil, en tant
que section, et supprimer la page.

### 12.1 Le texte n'est pas recopié

La section reprend le **même bloc éditorial** `about.body`. Il continue de se
modifier en BackOffice, rubrique Contenus, et rien n'a été dupliqué : une copie
aurait divergé de l'original au premier ajustement, et personne n'aurait su
laquelle des deux faisait foi.

La section est un `texte` posé à `sortOrder: 15`, entre le bandeau d'ouverture
et le bloc des objectifs, en variante « fond adouci » pour alterner avec lui.

### 12.2 Une ancre, pour ne pas casser ce qui pointait vers la page

Supprimer une page laisse derrière elle des signets, des courriels déjà envoyés
et des résultats de recherche. `/a-propos` redirige donc **en permanent** vers
`/#a-propos` : le code 301 apprend aux moteurs que l'adresse a bougé et
transfère le référencement acquis, et l'ancre amène le visiteur **sur** la
section plutôt qu'en haut d'une page longue.

Encore fallait-il que les sections aient une ancre. Trois précautions :

- **Un réglage déclaré, pas une donnée posée en douce.** `normaliserSection` ne
  conserve que les réglages du type ; une ancre non déclarée aurait disparu à la
  première modification de la section en BackOffice, sans que rien ne le
  signale — et la redirection serait devenue muette.
- **Ajoutée une fois pour tous les types.** `CATALOGUE` applique
  `REGLAGE_ANCRE` à chaque type plutôt que de la recopier huit fois : un type
  ajouté demain l'aura sans qu'on y pense. Un test le vérifie.
- **`scroll-mt-24` autant que l'`id`.** L'en-tête du site est collant : sans
  marge de défilement, le titre visé se retrouve caché dessous, et le lien passe
  pour cassé.

L'ancre est normalisée à la saisie : « À propos » devient `a-propos`. Un
`#À%20propos` fonctionne dans le navigateur qui l'a produit et nulle part
ailleurs.

### 12.3 Ce qui a été retiré

Page supprimée, et avec elle toutes ses attaches : l'entrée du menu « Le
Forum », la ligne du plan du site, la revalidation dans les actions de contenu.
Deux liens ont été **redirigés plutôt que supprimés** — celui du pied de page et
celui de l'état vide du programme — parce que la destination existe toujours,
sous une autre adresse.

### 12.4 Vérification

- `src/modules/sections/catalogue.test.ts` — l'ancre est proposée par tous les
  types, elle est normalisée, et elle survit à un enregistrement.
- `e2e/apparence.spec.ts` — l'ancienne adresse répond 200 après redirection,
  l'URL porte l'ancre, la section existe à cette ancre avec son titre, et le
  menu ne propose plus la page.

### 12.5 Modifier `defaut.ts` ne suffisait pas

La section n'apparaissait pas, alors que le code était juste et que l'image
construite le contenait bien. La cause tenait au dessin même du §8.4 : la
composition de `defaut.ts` ne sert qu'aux installations **où personne n'a encore
touché aux sections**. Dès qu'une première section est enregistrée en
BackOffice, la composition est matérialisée en base, et c'est la base qui pilote
la page.

Or la table en portait cinq lignes, dont une écrite par l'utilisateur le matin
même. Le code par défaut n'avait donc plus aucune prise.

`scripts/section-a-propos.ts` fait le travail sur une installation déjà en
service : il ajoute la section au rang 15, avec l'ancre, en reprenant le bloc
`about.body`. Il est **idempotent** — relancé, il ne crée pas de doublon — et
sait reconnaître le cas d'une installation neuve, où il n'a rien à faire. Il
décale d'un cran si le rang est occupé, plutôt que d'écraser un ordre choisi.

    pnpm section:a-propos --essai   # montre ce qui serait fait
    pnpm section:a-propos           # applique

La modification de `defaut.ts` reste en place et reste juste : elle sert aux
installations à venir.

### 12.6 Un test détruisait le travail de l'utilisateur

Trouvé en cherchant l'origine des lignes matérialisées, et bien plus grave que
le sujet de départ.

`e2e/parametres.spec.ts` vidait `PageSection` pour la page d'accueil **avant et
après** son exécution, afin de pouvoir compter un nombre exact de cartes. Sur
une instance de démonstration vide, sans conséquence. Sur l'instance réellement
utilisée, chaque passage de la suite effaçait la composition de la page
d'accueil, sections écrites en BackOffice comprises.

La correction ne consiste pas à sauvegarder puis restaurer : elle consiste à ne
plus exiger un état de départ. Le test relève les identifiants existants, ajoute
sa section, et affirme désormais une **variation** — rien de ce qui existait n'a
disparu, la section ajoutée est là — plutôt qu'un total absolu. Il ne supprime
en fin de course que ce qu'il a créé. Le cas de l'installation vide est
conservé : la matérialisation y est toujours vérifiée, et la table est rendue
vide pour que l'exécution suivante retrouve les mêmes conditions.

La règle générale, à appliquer aux autres suites : un test qui a besoin d'effacer
des données partagées pour tenir son assertion pose la mauvaise assertion.

### 12.7 Un échec de test non reproductible, consigné plutôt qu'expliqué

La suite complète a rendu **87 passés, 1 échec** : le test des sections ne
retrouvait pas sur la page d'accueil la section qu'il venait de publier.

Ce qui a été établi par la mesure :

- la ligne était bien en base, visible, avec le bon contenu et la bonne édition ;
- la page d'accueil rendait quatre sections au lieu de cinq ;
- l'attente de l'expiration du cache (60 s) n'y changeait rien, ni trois
  requêtes successives ;
- **recréer le conteneur a tout rétabli**, et le test passe depuis, deux fois de
  suite, cache chaud compris.

Ce qui n'a **pas** été établi : l'origine de cet état. J'ai avancé plusieurs
explications — invalidation par étiquette inopérante, écriture directe en base
contournant `invalider()`, cache périmé servi en arrière-plan — et chacune a été
démentie par la mesure suivante. Je les laisse ici comme pistes écartées, pas
comme diagnostic.

Ce qu'il faut retenir, et qui suffit à agir :

- **Si une section publiée n'apparaît pas sur le site, recréer le conteneur
  applicatif la fait apparaître.** Ce n'est pas une explication, c'est un geste
  qui marche, et il est bon de le connaître le jour du Forum.
- Toute écriture directe en base sur `PageSection` contourne `invalider()` :
  c'est vrai des tests comme de `scripts/section-a-propos.ts`. Le script a bien
  produit son effet immédiatement, mais rien ne le garantit.

À reprendre si le symptôme revient : instrumenter `sectionsEnCache` pour
distinguer un service depuis le cache d'une lecture en base, plutôt que de
déduire l'un de l'autre depuis l'extérieur.

## 13. Illustrations de section (11 septembre 2026)

Demande : utiliser certaines images de `public/images` sur la page d'accueil, et
pouvoir en déposer depuis le BackOffice en modifiant une section.

### 13.1 Le dépôt, dans le formulaire de la section

Le champ de fichier vit **dans le formulaire de la section**, et part donc au
même « Enregistrer » que le titre, le texte et les boutons.

C'est la leçon du §11.7, payée en deux allers-retours : le logo de partenaire
avait son propre formulaire et son propre bouton, à côté du bouton principal.
Choisir un fichier puis cliquer sur « Enregistrer » — le geste naturel — ne
l'envoyait pas, et l'écran répondait quand même « enregistré ». Ici, un seul
geste, donc rien à oublier. Le test E2E n'appuie sur aucun autre bouton : si
l'image reprenait un formulaire à part, il échouerait.

Le retrait passe par une case à cocher appliquée à l'enregistrement, et non par
un bouton immédiat : il n'y a pas de raison qu'une suppression d'image soit plus
brutale qu'une modification de texte.

L'ancien fichier n'est effacé qu'**après** la mise à jour réussie de la section.
Dans l'autre ordre, une écriture qui échoue laisserait une section pointant vers
un fichier disparu.

### 13.2 Où l'illustration a le droit d'aller

Le réglage n'est proposé qu'aux types qui ont une place pour elle — bandeau,
bloc de texte, appel à l'action. Les actualités, les intervenants et les
partenaires portent déjà leurs propres visuels ; un troisième n'y ferait
qu'encombrer. Un test énumère la liste, pour que l'ajout d'un type soit une
décision et non un effet de bord.

Le **fichier** est dans les réglages, son **texte alternatif** dans le contenu :
une image ne se traduit pas, sa description si.

### 13.3 Jamais une image derrière du texte

Dans le bloc de texte et l'appel à l'action, l'illustration est une image à part
entière, à côté ou au-dessus.

Dans le bandeau, elle est un décor : `aria-hidden`, cantonnée à la moitié droite
sur grand écran, estompée par un masque, absente sur téléphone où le texte
occupe toute la largeur. Aucun texte ne repose dessus.

Cette prudence n'est pas de la coquetterie : poser une image sous du texte
défait en une ligne tous les contrastes mesurés au §10, et le défaut ne se voit
que sur certaines images, à certaines tailles. Mieux vaut que la question ne se
pose pas.

### 13.4 Le détecteur d'image déposée, sorti du module sponsors

`sponsors/logo.ts` devient `src/lib/image-deposee.ts`. Le contrôle écrit pour le
logo d'un partenaire — SVG accepté sous conditions, dix formes d'attaque
refusées, type déduit des octets — vaut mot pour mot pour l'illustration d'une
section. Le dupliquer aurait garanti que les deux copies divergent.

La route qui sert l'illustration est ajoutée à `ROUTES_FICHIER_DEPOSE` dans le
middleware, et reçoit donc la même politique verrouillée (§11.5).

### 13.5 Les images fournies, et ce que j'en pense

`pnpm illustrer:accueil` importe deux fichiers de `public/images` dans le
stockage et les attache aux sections. Idempotent : une section déjà illustrée
est laissée telle quelle.

Le script **importe** au lieu de référencer `/images/…` : un fichier de
`public/` n'est modifiable que par un redéploiement, alors qu'une illustration
de section se remplace depuis le BackOffice. Le but est d'amorcer, pas de figer.

**Réserve, à dire clairement au commanditaire.** Les huit fichiers fournis sont
des illustrations de banque d'images représentant des graphiques génériques.
Deux d'entre elles tiennent leur rôle. Les autres sont redondantes entre elles,
et l'une porte un symbole monétaire sans rapport avec un forum statistique. Pour
une institution qui reçoit des délégations internationales, une photographie du
CICAD, de Dakar ou d'une édition précédente vaudrait mieux que n'importe laquelle
de ces images. La fonction de dépôt est là pour cela.

### 13.6 L'image était bien enregistrée : c'est l'adresse qui ne changeait pas

Signalé : « les images que j'uploade ne sont pas enregistrées, c'est toujours
l'ancienne qui s'affiche ».

Ma première explication était fausse. J'avais mesuré qu'au-delà de 3 Mo les
Server Actions rejettent la requête **avant** tout code applicatif — ce qui est
vrai, et documenté au §13.7 — et j'en ai conclu que le fichier était trop lourd.
L'utilisateur a répondu que ses fichiers faisaient moins d'1 Mo.

La mesure suivante a tranché : le serveur servait le **nouveau** fichier, 158 875
octets identiques à celui stocké. L'envoi fonctionnait depuis le début.

Le défaut est ailleurs. La route s'appelle `/api/v1/sections/<id>/image` et
répond `Cache-Control: public, max-age=600`. Cette adresse ne dépend que de
l'identifiant de la section : remplacer le fichier ne la change pas. Le
navigateur gardait donc l'ancienne image dix minutes, en BackOffice comme sur le
site.

Le comble : le service portait déjà ce commentaire — « suffixe aléatoire plutôt
qu'écrasement : un remplacement change l'URL, donc aucun cache ne peut servir
l'ancien logo ». C'était vrai du chemin de stockage, faux de l'adresse publique.
L'intention était écrite, la route la démentait, et personne ne l'avait relevé
parce que les deux fichiers ne se lisent pas ensemble.

**Correction.** `urlVersionnee` ajoute au lien une empreinte tirée du nom du
fichier : `?v=461b2ede1fb1`. Fichier différent, adresse différente, cache
contourné. Appliqué aux quatre endroits qui construisent ces adresses — rendu
public et aperçu BackOffice, pour les sections comme pour les logos de
partenaires, qui avaient exactement le même défaut.

**Leçon de méthode.** J'ai proposé une cause plausible avant d'avoir comparé les
octets servis au fichier stocké. C'est une comparaison de trente secondes, et
elle aurait évité une explication fausse et une reconstruction inutile. Devant
un « ça ne s'enregistre pas », vérifier d'abord **ce qui est réellement
stocké**, puis **ce qui est réellement servi** : le défaut est dans l'écart
entre les deux, pas forcément à l'écriture.

### 13.7 Le seuil silencieux des Server Actions

Conservé même s'il ne réglait pas le cas signalé, parce qu'il est réel et qu'une
photographie du CICAD le franchira. Mesuré sur l'interface :

| Taille du fichier | Ce que voit l'agent      |
| ----------------- | ------------------------ |
| 500 Ko            | « Section enregistrée. » |
| 1,8 Mo            | « Section enregistrée. » |
| 2,5 Mo            | « Image trop lourde »    |
| 4 Mo              | **rien du tout**         |

Au-delà de 3 Mo — la limite des Server Actions — la plateforme rejette avant
tout code applicatif : ni validation, ni message. Le navigateur réduit donc
l'image avant l'envoi, à 1600 px de côté, et annonce ce qu'il a fait. Si elle
reste trop lourde, elle est refusée **devant l'agent**, avec la raison.

Relever la limite aurait été le mauvais arbitrage : une illustration de 6 Mo
coûte bien plus cher aux visiteurs qu'à l'agent qui la dépose, et le brief vise
90 de performance (§3.2).

### 13.8 Deux pièges d'architecture rencontrés dans la foulée

**Prisma dans le paquet du navigateur.** Les fonctions d'URL avaient été
écrites dans `image-deposee.ts`, lequel importe la détection de type, laquelle
importe Prisma. Deux composants clients les utilisant, la construction échouait.
Elles vivent désormais dans `src/lib/url-fichier.ts`, sans aucune dépendance
serveur — même précaution que `modules/sponsors/constantes.ts`, dont le
commentaire décrivait déjà ce piège.

**Un ordre contradictoire dans le formulaire.** On pouvait à la fois choisir un
fichier et cocher « Retirer à l'enregistrement ». Le code faisait primer le
dépôt, mais rien ne le disait à l'écran. La case est maintenant neutralisée dès
qu'un fichier est choisi, et son libellé devient « Remplacée par le fichier
choisi ».

### 13.9 Vérification, et une instabilité de suite à surveiller

| Contrôle                                       | Résultat           |
| ---------------------------------------------- | ------------------ |
| Tests unitaires `lib/` et `sections/`          | 37 + 22 passés     |
| Suite des paramètres, dépôt et retrait compris | 7 passés           |
| Dépôt d'une image > 3 Mo                       | passé              |
| Suite E2E complète                             | 88 passés, 1 échec |
| Typage, lint                                   | propres            |

L'échec porte sur `scanner.spec.ts`, par dépassement de délai à 1,2 minute. Le
même fichier, relancé seul, passe ses trois tests en **12,6 secondes**. La suite
complète a par ailleurs duré 21,2 minutes contre 6 à 13 habituellement : la
machine était chargée.

C'est le même phénomène que celui mesuré sur l'audit Lighthouse (§10.11), et il
appelle le même réflexe : **un échec isolé dans une suite anormalement longue
accuse d'abord la machine**. Ne pas corriger le test sur cette base ; le rejouer
seul, et ne conclure qu'ensuite.

## 14. Contributions & Actes, première partie (11–14 septembre 2026)

Demande : ouvrir le chantier du lot 3 (brief §5.10), dont l'échéance prévue était
le 20 novembre puis l'après-Forum.

### 14.1 Découpage

Le lot se coupe en deux, et seule la première moitié est faite ici :

- **Maintenant** — saisir, déposer et publier des contributions par session ;
  les afficher sur la fiche de la session et sur la page « Contributions &
  Actes ». Utile dès la préparation du Forum.
- **Après le Forum** — compiler les Actes en PDF. Ils rassemblent synthèses et
  recommandations : ils n'ont de matière qu'une fois les sessions tenues.

Le modèle `Contribution` et la permission `contributions.write` existaient déjà
depuis le lot 0. Rien n'a été changé au schéma.

### 14.2 Le dépôt passe par une route, pas par une Server Action

Le brief autorise 50 Mo. Les Server Actions s'arrêtent à 3 Mo et rejettent
au-delà **avant** tout code applicatif, donc sans message (§13.7). Une
présentation de conférence dépasse couramment ce seuil : le dépôt se fait par
`POST /api/v1/contributions/[id]/fichier`.

La taille annoncée est contrôlée avant de lire le corps, pour qu'un fichier de
500 Mo ne soit pas mis en mémoire pour être refusé ensuite ; puis de nouveau
après lecture, l'en-tête pouvant mentir.

**Réserve assumée** : le fichier transite en mémoire le temps du contrôle, 50 Mo
au plus. À l'échelle du Forum, sans conséquence. Passer en écriture par flux
demanderait d'étendre l'interface de stockage, ce qui n'a d'intérêt que le jour
où les fichiers seront servis depuis un stockage objet.

### 14.3 Les deux surfaces d'entrée

Une contribution fait entrer sur le site public deux choses que l'ANSD n'a pas
écrites. Les contrôles s'y concentrent.

**Le fichier.** Type déduit des octets, jamais de l'extension. PDF reconnu à sa
signature ; PPTX reconnu à la signature ZIP **et** à la trace `ppt/` dans
l'en-tête de l'archive — sans quoi un DOCX ou une archive quelconque passerait.
Le risque visé n'est pas l'exécution, le serveur n'ouvre rien : c'est la
**distribution**. Un exécutable nommé `presentation.pdf` deviendrait un
téléchargement proposé par l'ANSD. Les documents sont servis en `attachment`,
jamais rendus comme une page du site.

**Le lien vidéo.** Liste fermée : YouTube et Vimeo, en https. Seul l'identifiant
de la vidéo est retenu, et l'adresse d'intégration est **reconstruite** par le
code. Un champ d'URL libre dans une `<iframe>` laisserait insérer n'importe
quelle page sur le site public. YouTube est intégré par son domaine
`youtube-nocookie.com`.

Une contribution non publiée ne se devine pas en tirant l'URL de son fichier :
404 pour qui n'a pas le droit de rédaction.

### 14.4 Ce qui a été repris des chapitres précédents

- **L'envoi part dès le choix du fichier** (§11.7) : pas de second bouton.
- **Aucun cache sur les lectures de contributions** (§13.6) : l'écran de saisie
  et la fiche publique montrent le même état.
- **L'ancien fichier n'est effacé qu'après l'écriture réussie en base**.
- **La route d'image est inscrite au middleware** (§11.5), une contribution PHOTO
  pouvant être un SVG.

### 14.5 React 19 vide le formulaire, et désynchronise la liste des types

Après chaque action d'un `<form action>`, React 19 remet le formulaire à zéro —
y compris quand l'action renvoie un refus.

**Premier symptôme, vu à la relecture du test** : un agent qui collait un lien
vidéo non reconnu perdait le titre et le texte qu'il venait d'écrire. Premier
correctif : renvoyer les valeurs saisies avec le refus, pour que la remise à zéro
les restaure. Le titre a bien survécu.

**Second symptôme, révélé par le test lui-même** : le second envoi, avec un lien
YouTube valide, était refusé par « ce type de contribution n'accepte pas de
lien ». La remise à zéro ramenait la liste « Type », contrôlée, à son option par
défaut dans la page, alors que l'état React gardait « Vidéo ». L'écran affichait
toujours le champ lien ; le formulaire envoyait un autre type. L'agent n'avait
rien changé. La base, vérifiée, ne contenait aucune ligne : le refus était réel.

Le premier correctif ne pouvait pas régler ce cas. La correction retenue ne
laisse plus React vider le formulaire : `useSoumissionSansRemiseAZero` envoie
depuis un `onSubmit`, dans une transition, ce qui garde l'état « en cours » sans
déclencher la remise à zéro. Après un ajout réussi, les champs repartent vides
parce que l'écran le décide — une clé qui change à chaque succès. Le test vérifie
désormais le titre **et** le type après un refus.

**Portée à noter** : le même comportement touche les autres formulaires de
création du BackOffice. Il n'a été corrigé que sur celui-ci. À reprendre écran
par écran si un agent le signale — ou d'un coup, en généralisant le renvoi des
valeurs dans l'état des actions.

### 14.6 Ce qui reste

- **Éditeur riche** (Tiptap, brief §5.10). Les textes sont en texte brut, retours
  à la ligne préservés, comme le reste du portail (T17). L'éditeur viendra avec
  la sanitisation serveur qu'il impose ; il ne chargera que dans le BackOffice,
  les pages publiques rendant du HTML déjà assaini.
- **Galerie** : chaque photo est une contribution. Un regroupement visuel en
  galerie sur la fiche de session reste à faire.
- **Actes du Forum en PDF** : après le Forum, comme prévu.
- **Fichiers orphelins à la suppression d'une session.** Supprimer une session
  efface ses contributions en base par cascade, mais pas leurs fichiers sur le
  disque : la cascade est faite par la base, qui ignore le stockage. Supprimer
  une contribution seule, elle, efface bien son fichier. Le cas est rare — une
  session n'est supprimable que sans inscrits — mais il laisse des documents
  derrière lui. À traiter en effaçant les fichiers dans le service des sessions
  avant la suppression, ou par un balayage périodique du stockage.

### 14.7 Vérification

| Contrôle                                          | Résultat               |
| ------------------------------------------------- | ---------------------- |
| Tests unitaires du module (types, vidéo, fichier) | 17 passés              |
| Parcours E2E Contributions                        | 5 passés               |
| Suite E2E complète                                | **96 passés**, 9,3 min |
| Typage, lint                                      | propres                |

Le parcours couvre : une synthèse publiée qui apparaît sur la fiche de session et
sur la page d'index ; un lien vidéo refusé puis accepté, **titre et type
conservés** après le refus ; un PDF de 4 Mo déposé par la route, servi en
téléchargement ; un exécutable renommé refusé ; une contribution non publiée
invisible sur le site et dont le fichier répond 404 sans session.

**Nettoyage du test, vérifié et non supposé.** La première version supprimait les
contributions en base mais laissait leur PDF sur le disque : trois orphelins de
4 Mo sur trois exécutions. Après correction, le test relancé seul laisse zéro
fichier et zéro ligne.

### 14.8 Question ouverte : qui saisit les contributions

Trois rôles ont aujourd'hui le droit, vérifié en base (les rôles sont
ajustables) : gestionnaire programme, admin forum, super administrateur.
L'écran s'ouvre depuis l'icône « Contributions » de chaque session.

Deux trous d'organisation, soumis au commanditaire le 14 septembre :

- **Les intervenants déposent leur présentation dans leur espace, et elle ne
  devient pas une contribution.** Deux circuits séparés ; le gestionnaire devrait
  redéposer le même fichier.
- **Aucun rôle de rapporteur.** Un rôle créé depuis l'écran des rôles aurait un
  droit global, sur toutes les sessions. Rattacher un rapporteur à ses sessions
  demande du développement.

Recommandation proposée : relier le dépôt des intervenants aux contributions, et
créer des rapporteurs rattachés à leurs sessions, la publication restant au
gestionnaire programme. **Retenue le 14 septembre** : voir §15.

## 15. Rapporteurs et dépôts des intervenants (14 septembre 2026)

Décision du commanditaire, sur la recommandation du §14.8 : « relier le dépôt des
intervenants aux contributions, et créer des rapporteurs rattachés à leurs
sessions, le gestionnaire programme gardant la publication ».

### 15.1 Qui fait quoi

| Acteur                                  | Droit                                | Périmètre            | Rédige         | Publie                    |
| --------------------------------------- | ------------------------------------ | -------------------- | -------------- | ------------------------- |
| Gestionnaire programme, administrateurs | `contributions.write`                | toutes les sessions  | oui            | **oui**                   |
| Rapporteur                              | `contributions.draft` + rattachement | ses sessions, seules | des brouillons | non                       |
| Intervenant                             | cookie de son espace                 | sa présentation      | la dépose      | non — il donne son accord |

Le gestionnaire est aussi seul à **rattacher** les rapporteurs et à **ordonner**
les contributions : déplacer un brouillon l'échange avec sa voisine, qui peut
être en ligne, et changerait l'ordre de la fiche publique sans relecture.

Le rapporteur ne modifie ni ce qui est déjà en ligne, ni la présentation déposée
par un intervenant ; il la lit. Hors de ses sessions, il n'a **rien** : l'écran
lui répond « Cette session ne vous est pas confiée », la route de dépôt 403.

Les règles tiennent dans `src/modules/contributions/droits.ts`, fonctions pures
testées en matrice. L'écran les consulte pour n'afficher que les gestes permis ;
le service les rejoue, parce qu'un formulaire se falsifie. Le rattachement est
**relu en base à chaque geste** : retirer un rapporteur prend effet
immédiatement, alors qu'un changement de rôle attend la reconnexion (T13).

### 15.2 Le rôle Rapporteur

- **Neuvième rôle, hors des huit du brief** (§12). Le test des rôles le liste à
  part, pour que l'écart reste visible.
- **Créé par migration** (`INSERT IGNORE`), pas par le seed. Le seed réécrit les
  permissions de tous les rôles à chaque passage (`update: { permissions }`) : y
  ajouter le rôle obligeait à relancer un seed qui efface les ajustements faits
  depuis l'écran des rôles. **Réserve** : cet effet du seed demeure pour qui le
  relancerait sur une installation en service ; à dire aux exploitants, et à
  arbitrer (un seed qui crée sans réécrire changerait le comportement de
  l'installation de référence).
- **Sans second facteur obligatoire** : le brief (§7) l'impose aux deux rôles
  d'administration, et le rapporteur n'a accès qu'à des brouillons. Il reste
  activable.
- Les comptes proposés au rattachement sont reconnus **par la permission**
  `contributions.draft`, pas par le nom du rôle : un rôle renommé ou
  personnalisé qui la porte est reconnu. Un gestionnaire n'est pas proposé — il
  voit déjà tout.
- Le rapporteur n'a pas de tableau de bord : la connexion, qui mène à `/admin`,
  le **redirige** vers `/admin/contributions`, où ne figurent que ses sessions.
- L'entrée « Contributions » revient au menu, sous Programme. Elle demande l'une
  **ou** l'autre permission (`exige: "une"`) : exiger les deux, comme les autres
  entrées, l'aurait cachée à tous sauf aux administrateurs.

### 15.3 Les dépôts des intervenants deviennent des contributions

À chaque dépôt, pour chaque session où l'intervenant figure, une contribution
« Présentation » d'origine `INTERVENANT` est créée, ou mise à jour si elle
existe. Arbitrages, à confirmer par le commanditaire :

- **Toujours en brouillon.** Le comité relit avant toute mise en ligne.
- **Un nouveau fichier la ramène en brouillon**, même si l'ancien était publié :
  le comité a validé un support, pas celui qui l'a remplacé.
- **Publication subordonnée à l'accord de l'intervenant**, case à cocher dans
  son espace. La règle existait déjà dans la route de la présentation : « sa
  publication éventuelle relève des Actes, avec l'accord de l'auteur ». Sans
  accord, la case « Publier » est grisée côté comité, et le serveur refuse.
  **Retirer l'accord retire la présentation du site**, sur-le-champ.
- **Type et intervenant figés** sur ces contributions : l'accord porte sur ce
  support et cette personne. Changer l'intervenant désigné suffirait sinon à
  publier sous l'accord d'un autre. Le fichier ne se remplace que depuis
  l'espace de l'intervenant.
- **Fichier copié, pas partagé.** L'intervenant remplace le sien, le
  gestionnaire supprime une contribution : avec un chemin commun, effacer l'un
  effacerait l'autre.
- La présentation reste **PDF seulement** côté intervenant, quand le comité
  accepte aussi le PPTX : c'est la règle d'origine de l'espace (la machine de la
  régie doit l'ouvrir).

### 15.4 Défaut corrigé au passage : 3 Mo, sans un mot

L'espace intervenant annonçait 20 Mo, mais le dépôt passait par une Server
Action : au-delà de 3 Mo, rejet avant tout code applicatif, aucun message. Le
défaut du §13.7, resté là. Le dépôt passe désormais par
`POST /api/v1/espace-intervenant/presentation`, authentifié par le cookie de
l'espace (`SameSite=Lax`), et part dès le choix du fichier. Le test l'éprouve
avec un PDF de 4 Mo.

### 15.5 Les refus sont éprouvés en forgeant

Masquer une case ne protège rien. Le parcours E2E forge donc le formulaire :

- une case « Publier » glissée dans le formulaire du rapporteur → « Seul le
  gestionnaire programme publie les contributions. », rien en base ;
- la case grisée faute d'accord, réactivée et cochée à la main → « L'intervenant
  n'a pas autorisé la publication de sa présentation. », rien en base ;
- un dépôt de fichier envoyé directement à la route pour une session non
  confiée → 403.

### 15.6 Incident de méthode : une migration en double

La commande de création de la migration, lancée avec le compte `root` (T38), a
été interrompue à l'approbation — mais sa première étape, `--create-only`, avait
déjà écrit son dossier. La migration a été recréée **sans `root`**, par
`prisma migrate diff --from-config-datasource --to-schema` (aucune base
fantôme, donc aucun `CREATE DATABASE`), puis appliquée par `migrate deploy`.
Le doublon a échoué à l'application sur la première colonne, déjà présente, avec
zéro étape appliquée ; il a été marqué `rolled-back` puis supprimé, après
comparaison de son contenu. `migrate status` : à jour.

Deux leçons : après une commande interrompue, **relire le dossier des
migrations** avant d'en appliquer ; et le passage par `migrate diff` rend le
compte `root` inutile pour créer une migration, ce qui lève l'essentiel de T38.

### 15.7 Ce qui reste

- ~~**Intervenant ajouté à une session après son dépôt**~~ — **traité au §15.9**,
  avec le rattachement des intervenants aux sessions, qui n'existait pas.
- **Aucune notification** au gestionnaire quand un intervenant dépose ou qu'un
  rapporteur rédige ; l'écran d'index affiche, par session, brouillons et dépôts
  d'intervenants.
- Les fichiers orphelins à la suppression d'une session (§14.6) valent aussi
  pour les copies des présentations.
- Réserve du seed (§15.2).

### 15.8 Vérification

Sur l'image de production reconstruite, conteneur **recréé** et non redémarré
(§10.8) : identifiant de l'image et du conteneur identiques, `/api/health` 200.
Journal de construction relu : les 34 pages se génèrent, `/admin/contributions`
et `/api/v1/espace-intervenant/presentation` figurent dans la liste des routes ;
les seuls avertissements sont ceux, préexistants, de `bullmq` et de `jose`.

| Contrôle                                               | Résultat                |
| ------------------------------------------------------ | ----------------------- |
| Tests unitaires (dont matrice des droits, menu, rôles) | **386 passés**          |
| Parcours E2E Rapporteurs (nouveau)                     | 7 passés                |
| Contributions, intervenants, administration            | 16 passés               |
| Suite E2E complète                                     | **103 passés**, 6,3 min |
| Typage, lint                                           | propres                 |
| `prisma migrate status`                                | à jour                  |

**Nettoyage vérifié sur le disque, et un défaut ancien trouvé ainsi.** Le
nouveau parcours ne laisse rien : zéro intervenant, zéro contribution, zéro
rattachement, aucun fichier de contribution. Mais le même contrôle a montré
**29 présentations et 30 photos orphelines** dans le stockage, sans aucune ligne
en base pour les désigner : le test de l'espace intervenant supprimait
l'intervenant sans ses fichiers, à chaque exécution depuis sa création. Les
fichiers ont été identifiés avant suppression — les PDF portent tous le marqueur
« test E2E » du test, les photos ont toutes la même empreinte, celle de l'image
générée par le test — puis supprimés. Le test efface désormais ses fichiers ;
relancé seul, il n'en laisse aucun (avant 1 / après 1, le restant datant de la
suite complète lancée avant la correction, et supprimé ensuite).

### 15.9 « J'ai déposé une contribution, elle ne s'affiche nulle part »

**Le cas signalé.** Un intervenant créé depuis le BackOffice dépose sa
présentation (trois dépôts, accord de publication donné) : « Présentation
enregistrée », puis rien, ni sur l'écran Contributions, ni ailleurs. Mesuré en
base : l'intervenant était rattaché à **zéro session**. Le §15.3 crée une
contribution par session de l'intervenant ; sans session, aucune.

**La cause profonde, plus large que le symptôme.** Aucun écran ne permettait de
rattacher un intervenant à une session : dans tout `src/`, aucune écriture de
`SessionSpeaker` ; seul `prisma/seed.ts` en créait. Le brief (§5.8) demande
pourtant « statut de confirmation par session ». Tout intervenant créé en
BackOffice restait donc hors programme — et sa présentation, hors des
contributions, sans qu'aucun écran ne le dise. Les tests ne l'avaient pas vu :
ils créaient leurs intervenants **déjà rattachés**, directement en base.

**Corrigé :**

- **Rattachement aux sessions**, sur la fiche de l'intervenant
  (`/admin/intervenants/[id]/modifier`, permission `speakers.write`) : ajout
  avec un rôle, statut de confirmation modifiable (enregistré au changement),
  retrait sur confirmation. La session doit appartenir à l'édition de
  l'intervenant ; une session supprimée n'est pas proposée.
- **Présentation déposée avant le rattachement** : elle rejoint la session dès
  que l'intervenant y est ajouté, en brouillon. Une contribution déjà présente
  n'est pas touchée (la remplacer la ramènerait en brouillon).
- **Retrait** : la présentation sort de la session si elle n'y est qu'en
  brouillon, fichier compris ; **en ligne, elle reste**, et le message le dit —
  la dépublier est une décision, pas l'effet de bord d'un changement de
  programme.
- **L'espace intervenant dit où va le fichier** : « Aucune session ne vous est
  encore attribuée » ou « transmise au comité pour N sessions », au lieu d'un
  « Présentation enregistrée » qui laissait croire l'envoi arrivé.
- **Le gestionnaire voit les dépôts en attente** : un bloc « Présentations en
  attente de session » sur `/admin/contributions`, avec le lien vers la fiche.
- **Sessions supprimées** (suppression douce) : elles n'apparaissaient pas moins
  dans l'index des contributions, et recevaient les dépôts. Filtrées.
- Le rôle `GUEST_OF_HONOR` du schéma n'avait de libellé nulle part : « Invité
  d'honneur ».

Le parcours E2E `intervenant-sessions.spec.ts` rejoue le cas exact, avec un
intervenant créé **sans** session : dépôt et message, bloc « en attente » et son
lien, rattachement et contribution en brouillon, statut vu par l'intervenant,
retrait avec effacement du fichier.

**Vérification**, sur l'image reconstruite et le conteneur recréé (identifiants
identiques, `/api/health` 200 ; avertissements de construction inchangés,
`bullmq` et `jose`) :

| Contrôle                                                                            | Résultat                          |
| ----------------------------------------------------------------------------------- | --------------------------------- |
| Typage, lint, tests unitaires                                                       | propres, **386 passés**           |
| Parcours concernés (intervenant-sessions, intervenants, rapporteurs, contributions) | **22 passés**, 1,5 min            |
| Suite E2E complète                                                                  | 100 passés, 2 en échec            |
| Les deux fichiers en échec, relancés seuls                                          | **8 passés** sur 8                |
| Stockage après la suite                                                             | 0 orphelin, 0 intervenant de test |

**Les deux échecs de la suite complète ne sont pas des régressions, et c'est
mesuré.** La suite a duré 1 h 06 au lieu de 7 minutes, et l'une des erreurs était
`net::ERR_NETWORK_IO_SUSPENDED` — celle que Chromium rend quand la machine
suspend le réseau. Le journal système le confirme : mises en veille à 13 h 42,
14 h 04 et 15 h 01, pendant l'exécution. Les deux fichiers concernés
(`badges-masse`, `zones`) passent intégralement relancés seuls, machine éveillée.
Leçon de méthode : une suite longue lancée en arrière-plan sur un poste portable
doit se lire avec sa **durée** ; une durée anormale signale un environnement
perturbé avant tout diagnostic de code.

## 16. Le scanner ne voyait pas la caméra (14 septembre 2026)

### 16.1 Le signalement

Sur `/scan`, « Caméra indisponible. Utilisez la recherche manuelle. » ; la
recherche manuelle fonctionne. Question jointe : une application à installer
sur les téléphones et tablettes des agents d'accueil.

### 16.2 Ce qui a été écarté, par la mesure

- **L'appareil** : Windows voit une caméra en état OK, et l'accès caméra est
  autorisé, applications de bureau comprises.
- **Le contexte sécurisé** (T41) : `localhost` en est un.
- **La contrainte vidéo** : `facingMode: { ideal: "environment" }`, souple — une
  webcam frontale la satisfait.

### 16.3 La cause, reproduite avant d'être corrigée

`Permissions-Policy: camera=(self)` n'est posée que sur les pages caméra ; toutes
les autres portent `camera=()`. Or cette politique est fixée **au chargement du
document**, et le menu du BackOffice navigue sans recharger. L'agent se connecte,
arrive sur `/admin` (`camera=()`), clique « Scanner » : la page change, le
document reste — et sa politique avec lui. `getUserMedia` est refusé, sans
boîte de dialogue, sans que l'appareil ni ses réglages y soient pour rien.

C'est **le parcours normal d'un agent d'accueil** : son rôle n'a pas de tableau
de bord, il atterrit sur `/admin` et doit passer par le menu. Pire, la connexion
ignorait `callbackUrl` : ouvrir directement `/scan` renvoyait aussi sur `/admin`.

Reproduit avec Chrome et une caméra simulée (`--use-fake-device-for-media-stream`) :
chargé directement, le flux démarre ; ouvert depuis le menu,
`politique: false, flux: false`, message « Caméra indisponible » — l'écran
signalé.

Le test historique du scanner ne l'avait pas vu : il vérifiait l'en-tête de
`/scan` **chargé directement**, soit le seul chemin qui fonctionnait.

### 16.4 Corrigé, en trois couches

1. **Une source unique des pages caméra** (`src/lib/pages-camera.ts`), lue par le
   middleware (politique) et par le menu, qui y mène par un **lien ordinaire**,
   donc un rechargement complet. Un test unitaire vérifie que chaque page caméra
   est bien une entrée du menu.
2. **Un filet au montage** du scanner et du comptoir d'accueil
   (`useDocumentAvecCamera`) : si le document refuse la caméra, rechargement
   **une fois**, garde anti-boucle de 15 s. Il couvre les chemins que le menu ne
   couvre pas (retour arrière, lien ajouté demain ailleurs). Au montage, rien
   n'est encore saisi.
3. **La cause dite à l'agent**, avec son geste : autorisation refusée (réglages du
   navigateur), aucune caméra, caméra occupée par une autre application, adresse
   non sécurisée (passer par https://), page à recharger — et un bouton
   « Réessayer » ou « Recharger ». « Caméra indisponible » seul ne permettait pas
   d'agir.

S'y ajoute **la destination après connexion** : `callbackUrl` est désormais
suivie, validée côté serveur (`connexion/destination.ts` : même site, chemin
seul, BackOffice ou scanner uniquement — les formes classiques de redirection
ouverte `//hote`, `/\hote`, `javascript:` sont refusées et testées). Vers une
page caméra, la connexion laisse le navigateur charger la page lui-même : la
redirection d'une Server Action est une navigation interne, qui reproduirait le
défaut.

### 16.5 La question de l'application

**Elle existe déjà sous la forme retenue par le brief (D4)** : `/scan` est une
application web installable, avec manifeste (`public/scan.webmanifest`), service
worker (`public/scan-sw.js`, coquille disponible hors réseau), manifeste des
badges et file des scans en IndexedDB, synchronisation différée. Installée depuis
Chrome sur Android (« Installer l'application ») ou Safari sur iPhone/iPad
(« Sur l'écran d'accueil »), elle s'ouvre en plein écran comme une application.

Ce qui manque pour qu'elle s'installe **proprement** sur les appareils :

- **Une adresse en HTTPS** (T41, T1) : caméra et service worker sont refusés en
  `http://` sur une adresse du réseau local. C'est la condition bloquante.
- ~~**Des icônes**~~ — **fait au §16.7** : le manifeste ne déclarait que le
  favicon en 48 px, alors que Chrome sur Android exige 192 et 512 px pour
  proposer l'installation, et qu'iOS lit une `apple-touch-icon`, absente.
- **Un essai sur les appareils réels** des agents, à la répétition générale
  (4.11) : caméra arrière, luminosité du hall, autonomie.

Une application native (Play Store, App Store, ou coquille Capacitor) n'apporte
rien que la PWA ne fasse déjà pour le Forum, et ajoute comptes développeur,
validation par les magasins et mises à jour à redistribuer. Elle ne se justifie
que si l'ANSD veut un déploiement par gestion de flotte (MDM) ou un mode kiosque
verrouillé.

### 16.6 Vérification

Sur l'image reconstruite et le conteneur recréé : identifiants identiques,
`/api/health` 200, aucune erreur de compilation, avertissements inchangés
(`bullmq`, `jose`).

| Contrôle                                                      | Résultat                                      |
| ------------------------------------------------------------- | --------------------------------------------- |
| Typage, lint                                                  | propres                                       |
| Tests unitaires (dont pages caméra, destination de connexion) | **393 passés**                                |
| Caméra simulée : chargement direct, menu, accueil, connexion  | **4 passés** — le cas « menu » échouait avant |
| Scanner, accueil, administration                              | 13 passés                                     |
| Suite E2E complète, veille bloquée                            | **111 passés**, 10,4 min                      |
| Stockage après la suite                                       | 0 orphelin, 0 donnée de test                  |

**La reproduction précède la correction** : le test « ouvert depuis le menu » a
été écrit et lancé contre l'image non corrigée, où il rendait
`politique: false, flux: false` — l'écran signalé. Il passe désormais.

**La suite a tourné machine éveillée** : `SetThreadExecutionState` interdit la
mise en veille pendant la durée du seul processus de test, puis rend la main.
La précédente exécution avait duré 1 h 06 à cause des veilles (§15.9) ; celle-ci,
10,4 min pour 111 tests.

**Une fausse alerte de nettoyage, corrigée avant d'agir.** Le contrôle du
stockage, réécrit en PowerShell pour cette exécution, a signalé trois
« orphelins » : ses requêtes SQL, mal protégées par l'imbrication des
guillemets, n'avaient rien renvoyé, si bien que tout fichier paraissait sans
propriétaire. Refait avec la version éprouvée : les trois fichiers appartiennent
à des données réelles — l'intervenant du signalement, **désormais rattaché à une
session**, et sa présentation devenue contribution publiée. Rien n'a été
supprimé. La règle tient : on ne supprime qu'un fichier dont on a établi, par une
mesure qui fonctionne, qu'il n'appartient à personne.

### 16.7 Les icônes d'installation (15 septembre 2026)

**Fait** : quatre icônes, dessinées d'après la marque du site (carré bleu nuit,
trois barres bleu clair, verte et blanche) par `scripts/icones-scanner.ts`
(`pnpm icones:scanner`), sans dépendance — `sharp` n'est pas installé.

| Fichier                       | Usage                                                               |
| ----------------------------- | ------------------------------------------------------------------- |
| `icons/scan-192.png`, `-512`  | Android, coins arrondis, fond transparent autour                    |
| `icons/scan-maskable-512.png` | Android, formes découpées : fond plein bord, logo dans la zone sûre |
| `icons/scan-apple-180.png`    | iPhone et iPad : opaque, iOS arrondit lui-même                      |

- Le manifeste déclare les trois premières et reçoit un `id` ; la mise en page du
  scanner déclare l'icône iOS et les balises « application web » d'Apple (plein
  écran depuis l'écran d'accueil).
- **Le service worker servait le manifeste depuis son cache.** Un appareil ayant
  déjà ouvert le scanner aurait gardé l'ancien manifeste, sans icônes. Le
  manifeste passe en « réseau d'abord », et le cache change de version
  (`forum-scan-v2`), ce qui purge l'ancien à l'activation.
- **Vérifié par Chrome lui-même** : `scanner-installation.spec.ts` lit
  `Page.getInstallabilityErrors` et exige une liste vide, dans un profil
  persistant — un profil de session privée figure lui-même parmi les obstacles.
  Un test unitaire vérifie que chaque icône déclarée existe, à la taille
  annoncée, et que l'icône iOS est opaque.

**Un déploiement raté, et ce qu'il enseigne.** Ajouter le script au
`package.json` a invalidé la couche de dépendances de l'image : le build a
retéléchargé tous les paquets, la connexion a lâché (`ECONNRESET`, `EAI_AGAIN`),
puis la machine s'est mise en veille pour la nuit. Plus grave, la commande de
déploiement **n'enchaînait pas sur l'échec** : elle a recréé le conteneur sur
l'ancienne image, les icônes répondaient 404, et les tests ont tourné quinze
heures. Rien n'a été annoncé comme fait. Le déploiement passe désormais par un
script qui s'arrête au premier échec, ne recrée le conteneur que sur une image
**nouvelle** et un environnement complet, et interdit la veille le temps de son
exécution.

| Contrôle                                          | Résultat                              |
| ------------------------------------------------- | ------------------------------------- |
| Typage, lint                                      | propres                               |
| Tests unitaires (dont installation)               | **397 passés**                        |
| Build, image nouvelle, conteneur recréé           | 9 min, identifiants identiques        |
| Icônes et manifeste servis                        | 4 × `200 image/png`, manifeste à jour |
| Installation (Chrome), caméra, scanner hors ligne | **8 passés**                          |

La suite complète n'a pas été relancée pour ce changement, circonscrit à `/scan`
(fichiers statiques, manifeste, service worker, métadonnées de sa mise en page) :
les parcours du scanner, hors ligne compris, le couvrent. Sa dernière exécution,
sur l'image précédente, compte 111 tests passés (§16.6).

Reste, pour une installation sur les appareils des agents : l'adresse en HTTPS
(T1, T41) et l'essai sur les appareils réels à la répétition générale (4.11).

## 17. Sections : fond sombre, position de l'illustration, texte mis en forme (15 septembre 2026)

Trois demandes du commanditaire sur les paramètres des sections.

### 17.1 « Fond sombre », plus foncé que le fond adouci

Proposé partout où un fond l'est déjà : bloc de texte et appel à l'action.

La section ne reçoit pas des couleurs claires posées une à une : elle passe
**entière** dans le thème sombre du site (`data-theme="dark"`), dont chaque couple
texte/fond est déjà mesuré. Des couleurs posées à la main auraient laissé un lien
ou un bouton dans les tons du thème clair, illisible sur fond foncé — c'est le
défaut du pied de page corrigé au §10 (1,69:1).

Le fond est un jeton propre, `--fond-sombre` :

- **thème clair** : `#082c4e`, le bleu nuit de la marque ;
- **thème sombre** : `#03101f`, plus foncé que le fond de page — sans quoi « Fond
  sombre » et « Fond clair » seraient identiques quand le visiteur est en thème
  sombre.

Il est défini sur `:root` et dans le bloc `prefers-color-scheme`, **pas** dans le
bloc `[data-theme="dark"]` : la section porte elle-même cet attribut, et y
redéfinir le jeton lui aurait donné la valeur sombre même dans une page claire.
`palette.test.ts` vérifie tout cela — chaque texte du thème sombre ≥ 4,5:1 sur les
deux valeurs, fond plus foncé que le fond adouci dans les deux thèmes, contour de
focus ≥ 3:1, et absence du jeton dans le bloc `[data-theme="dark"]`.

### 17.2 Position de l'illustration

Réglage « À droite / À gauche du texte », déclaré avec l'illustration sur les trois
types illustrables (bandeau, bloc de texte, appel à l'action). Par défaut « à
droite », la disposition d'avant. Nouveau type de réglage `choix` au catalogue,
dont une valeur inconnue retombe sur le défaut.

- **Seule la disposition change** : dans la page, le texte vient toujours avant
  l'image (`order` CSS), donc même ordre de lecture à la synthèse vocale et sur
  téléphone, où l'image passe sous le texte.
- **Bandeau** : l'illustration y est un décor estompé. La règle « aucun texte ne
  repose sur le décor » est tenue des deux côtés : à gauche, le texte passe à
  droite ; avec le compteur, c'est le panneau qui vient à gauche, par-dessus.
- **Appel à l'action** : avec une illustration, le panneau s'organise en deux
  colonnes sur grand écran ; sans elle, il reste centré.

### 17.3 Texte mis en forme

Éditeur **Tiptap 3.31** (celui que le brief prévoit, §5.10), dans le BackOffice
seulement, sur les textes longs : texte du bloc, phrase de l'appel à l'action,
introduction du bandeau. Les titres restent en texte simple.

Barre d'outils : gras, italique, souligné, listes à puces et numérotées, saut de
ligne, lien, retrait du lien, effacement de la mise en forme, annuler, rétablir ;
raccourcis clavier habituels ; compteur de caractères. La zone d'édition est
nommée par son étiquette visible (`aria-labelledby`), sous le même libellé qu'avant.

**Stockage : un document structuré, jamais du HTML.** L'éditeur sait produire du
HTML, mais le stocker obligeait à le nettoyer à chaque affichage, et un nettoyeur
contourné laisse passer un `<img onerror>` sur la page d'accueil. Le texte est
stocké en JSON, réduit par `src/lib/texte-riche.ts` à une liste fermée — paragraphe,
saut de ligne, listes ; gras, italique, souligné, lien — puis rendu **élément par
élément** par `TexteRiche`, où React échappe le texte. Aucun chemin ne transforme
une saisie en balisage : une balise tapée s'affiche telle quelle.

- **Liens** : http(s), `mailto:` et chemins internes seulement ; `javascript:`,
  `data:`, `//hote` et `/\hote` refusés. Un lien refusé perd son lien, pas son
  texte. Lien externe : nouvel onglet, `rel="noopener noreferrer"`.
- **Pas de titres** dans le texte : la section porte le sien, et un titre dans un
  paragraphe casserait la hiérarchie suivie par les lecteurs d'écran. Collé depuis
  un document, un titre devient un paragraphe.
- **Nettoyé deux fois** : dans le navigateur, puis au serveur, parce qu'un champ
  caché se falsifie.
- **Longueur** : comptée en caractères visibles, pas en balisage, et vérifiée au
  serveur pour tous les champs — l'attribut `maxLength` d'un formulaire ne protège
  pas d'une Server Action appelée sans lui.
- **Champ vidé** : enregistré comme chaîne vide, pour que le repli de l'anglais sur
  le français continue de jouer.
- **Compatibilité** : les textes saisis avant l'éditeur, en texte brut, s'affichent
  comme avant (ligne vide = paragraphe, retour = saut de ligne) et sont convertis au
  premier enregistrement, sans perte.

**Coût** : trois dépendances (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`),
chargées par le seul écran des sections ; la page publique n'embarque rien de
l'éditeur. Leur ajout a invalidé la couche de dépendances de l'image : un build
complet, avec téléchargement.

**Tests** : rendu des marques et des listes, échappement, liens refusés, conversion
du texte brut, longueurs, repli de langue (unitaires, dont un rendu React côté
serveur — il a fallu configurer Vitest : Vite 8 transforme avec Oxc, et l'option
`esbuild` était ignorée) ; parcours E2E `sections-mise-en-forme.spec.ts`, de la
barre d'outils à la page publique.

### 17.4 Vérification

Sur l'image reconstruite (`d1739bad052b`, 6 min 25 s) et le conteneur **recréé** :
identifiants de l'image et du conteneur identiques, `/api/health` 200. Journal de
construction relu : 34/34 pages générées ; seuls avertissements, ceux préexistants
de `bullmq` et de `jose`, et les trois `SecretsUsedInArgOrEnv` de Docker sur les
`ARG` de construction — des valeurs factices, documentées dans le Dockerfile ;
`stack.sh` ne passe aucun `--build-arg`.

| Contrôle                                                 | Résultat                                            |
| -------------------------------------------------------- | --------------------------------------------------- |
| Typage, lint                                             | propres                                             |
| Tests unitaires (palette, catalogue, texte riche, rendu) | **439 passés**                                      |
| Sections : mise en forme, paramètres, poids des images   | **11 passés**, sur la nouvelle image                |
| Suite E2E complète, veille bloquée (image précédente)    | 113 passés, 1 échec non reproduit — voir ci-dessous |
| Stockage après les parcours                              | 0 illustration orpheline, 0 section de test         |

- **Poids** : l'écran des sections charge 264 kB, éditeur compris ; la page
  d'accueil reste à 108 kB, sans rien de l'éditeur.
- **Suite complète** : jouée avant le correctif de suppression décrit plus bas, qui
  ne touche que la suppression d'une section — rejouée, elle, par les 11 parcours
  des sections sur la nouvelle image. Le seul échec, « scanner ouvert depuis le
  menu » (§16), n'a pas été reproduit : relancé seul, le fichier passe 4 sur 4.
  Il est à surveiller.

**Un défaut ancien, trouvé en contrôlant le stockage.** Après la suite complète,
10 illustrations de section n'étaient désignées par aucune section. Deux causes :

- **Produit** : `supprimerSection` effaçait la ligne et laissait le fichier.
  Chaque section supprimée par un agent laissait donc son image sur le disque. Le
  fichier est désormais effacé **après** la ligne — dans l'autre ordre, un échec
  laisserait une section pointant vers un fichier disparu —, et son chemin figure
  dans l'audit de la suppression.
- **Test** : `sections-image.spec.ts` supprimait sa section directement en base,
  sans son fichier, soit environ 1 Mo laissé à chaque exécution. Il efface
  désormais le fichier.

Les 10 fichiers ont été identifiés avant suppression. Pour chacun : aucune section
en base, et une création journalisée par le compte `e2e.admin@example.test`. Ils
ont ensuite été supprimés.

**La reproduction a précédé la correction.** Le parcours « supprimer la section
depuis le BackOffice efface aussi son illustration » passe par le bouton et la
confirmation, comme un agent. Lancé d'abord contre l'image non corrigée, il a
échoué : le fichier était resté. Il passe sur la nouvelle image, et l'audit porte
le chemin du fichier effacé. Ce premier essai a lui-même laissé un orphelin : le
nettoyage final cherchait le chemin dans une ligne déjà supprimée. Le test retient
désormais ce chemin dès l'enregistrement. L'orphelin, identifié de la même façon,
a été effacé.

## 18. Audit de sécurité et correctifs (16 septembre 2026)

Audit de l'ensemble du code à la demande du commanditaire : 27 routes API, 24
fichiers de Server Actions, middleware, authentification, stockage, rendus PDF,
exports, configuration de production et dépendances. Chaque point vérifiable l'a
été **par une mesure** sur la stack locale, avec un compte jetable créé puis
supprimé avec son journal.

Aucune faille critique. Une élevée, trois moyennes, une moyenne à faible et trois
faibles, toutes corrigées ici. Le rapport n'a été consigné qu'une fois les
correctifs écrits : ce fichier est versionné, et l'un des dépôts distants est
public.

### 18.1 Sessions du BackOffice impossibles à fermer (élevée)

**Mesuré** : un compte désactivé ne pouvait plus se connecter (`INACTIVE`), mais
sa session ouverte ouvrait toujours `/admin/presences` (200). La session est un
jeton signé portant, figés à la connexion, le rôle et les permissions ; rien ne
le relisait. Il vit 30 jours après la dernière visite et chaque visite le
prolonge. Même effet pour un mot de passe ou un second facteur réinitialisé, et
un rôle modifié n'agissait qu'à la reconnexion (limite T13).

**Correctif** : `src/modules/auth/revalidation.ts`, branché sur le callback `jwt`
de la configuration Node (`src/auth.ts`). À chaque `auth()`, le compte est relu :
actif, **version de session** égale à celle du jeton, rôle et permissions
rafraîchis. Sinon la session est refusée.

- Nouvelle colonne `User.sessionVersion`, incrémentée à la **désactivation** (sans
  quoi réactiver le compte rouvrirait les anciennes sessions), au remplacement du
  mot de passe, au détachement du second facteur et à son activation.
- Un changement de rôle ou de droits ne ferme rien : il s'applique à la requête
  suivante. Les textes des écrans Rôles et Utilisateurs le disent désormais.
- Le calcul des droits est **un seul** (`droitsDuCompte`), pour la connexion et la
  revalidation.
- Le middleware, qui tourne sans base, voit toujours un jeton signé. Mais le
  layout du BackOffice renvoie vers la connexion, et chaque page, action et route
  lit la session par `auth()`, donc revalidée.
- Coût : une lecture par clé primaire à chaque `auth()`.
- Les jetons émis avant ce changement n'ont pas de version : **chacun devra se
  reconnecter une fois** après le déploiement.

### 18.2 Code à 6 chiffres de l'espace participant (moyenne à élevée)

Chaque demande créait un code valable 30 minutes sans annuler les précédents. À
3 demandes par minute, environ 90 codes étaient valides en même temps ; à
5 essais par minute, cela donnait environ 2,7 % de réussite par heure et près
d'une chance sur deux par jour sur un participant visé (calculé, non mesuré).
L'enjeu : ses données et son badge, dont le QR code ouvre l'accès physique.

**Correctif** (`src/modules/auth/magic-link.ts`) :

- une nouvelle demande **annule** les liens non utilisés du compte (participants
  et intervenants) ;
- seul le **dernier** lien valide est comparé ;
- **5 codes erronés annulent le lien** (nouvelle colonne
  `MagicLink.failedAttempts`) ;
- **10 demandes par jour** au plus par adresse, en plus des 3 par minute ;
- consommation **atomique** : deux requêtes simultanées ne peuvent plus utiliser
  le même lien ;
- le code d'un participant supprimé est refusé.

Soit au plus 50 essais par jour contre un seul code : environ 0,005 % par jour.
Contrepartie : seul le dernier e-mail reçu est valable, ce que dit déjà le message
« lien expiré, demandez-en un nouveau ».

### 18.3 Adresse IP falsifiable (moyenne)

**Mesuré** : 35 vérifications de badge avec la même IP annoncée, 5 refusées ; en
changeant le premier élément de `X-Forwarded-For`, aucune. nginx **ajoutait**
l'adresse réelle à la suite de l'en-tête du client, et six endroits du code en
lisaient le **premier** élément. Les limites par IP (inscription, vérification de
badge) ne limitaient rien, et les IP du journal d'audit étaient au choix du
visiteur.

**Correctif** : `src/lib/adresse-client.ts`, seule lecture de l'adresse — d'abord
`X-Real-IP`, que nginx écrase, sinon le **dernier** élément de `X-Forwarded-For`.
`docker/nginx.conf` écrase désormais `X-Forwarded-For` et `X-Forwarded-Host` au
lieu de les compléter. Condition de sécurité : l'application n'est joignable que
par le proxy, ce qu'assure `docker-compose.prod.yml` (aucun port publié pour
`app`).

### 18.4 Injection de formules dans les CSV (moyenne)

Excel prend pour une formule une cellule CSV commençant par `=`, `+`, `-` ou `@`,
même entre guillemets. Noms, organisations et fonctions viennent du formulaire
public ; l'IP du journal d'audit venait d'un en-tête (§18.3). Une organisation
`=HYPERLINK(…)` devenait un lien piégé dans le rapport ouvert par un
administrateur.

**Correctif** : `neutraliserFormule` dans `versCsv` (apostrophe en tête,
recommandation OWASP). Nombres et numéros de téléphone restent intacts : sans
lettre, une cellule ne peut appeler aucune fonction. L'export des inscrits d'une
session, qui avait sa propre copie du CSV, passe désormais par `versCsv`. XLSX et
PDF n'étaient pas concernés.

### 18.5 Second facteur remplaçable (moyenne à faible)

La page d'enrôlement restait ouverte aux comptes ayant déjà un second facteur,
et l'action enregistrait le secret reçu sans vérifier : depuis une session volée,
on remplaçait le second facteur de la victime par le sien.

**Correctif** : la page renvoie au tableau de bord si le second facteur est actif ;
`enableTotp` refuse (`DEJA_ACTIVE`) **dans la même écriture** que l'activation,
valide le format base32 du secret et incrémente la version de session. Changer de
téléphone passe par « Détacher le 2FA », réservé aux gestionnaires des comptes.

Le secret reste transmis par le formulaire : le sceller n'aurait rien ajouté, la
personne qui charge la page le reçoit de toute façon pour le scanner.

### 18.6 Points faibles

- **Catégorie d'inscription** : acceptée par son seul identifiant, donc aussi
  retirée ou d'une autre édition. Elle doit désormais appartenir à l'édition et,
  hors invitation, être active (`CATEGORY_INVALID`, avec un message).
- **`/api/health`** renvoyait publiquement le message d'erreur MySQL. Le détail
  part dans les journaux du serveur ; supervision et `stack.sh` ne lisent que le
  code HTTP.
- **Anti-robot** : sans clés Turnstile, il était désactivé sans bruit. Un
  avertissement est journalisé au démarrage en production. **À faire avant la mise
  en ligne** : renseigner `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY`.

### 18.7 Dépendances

`pnpm audit --prod` : 14 alertes (6 élevées), toutes transitives.

- **Corrigées** : `nodemailer` 9.1.0 → 9.1.1 ; `mariadb` 3.4.5 → 3.4.7 par
  surcharge pnpm (`@prisma/adapter-mariadb` fige 3.4.5). Ni l'une ni l'autre
  n'était exploitable ici — pas de pièces jointes, jeu de caractères utf8mb4,
  réseau Docker interne —, mais les correctifs étaient des versions de maintenance.
  L'avertissement de dépendance paire de `next-auth` sur `nodemailer` existait déjà
  avec 9.1.0.
- **Restantes, non atteignables à l'exécution** (10) : `postcss` via Next, qui ne
  traite que nos propres feuilles à la construction ; `mysql2`, `lodash` et
  `deepmerge-ts` via la CLI et le Studio de Prisma, utilisés pour les migrations
  et jamais sur le chemin d'une requête. À reprendre avec les montées de version
  de Next et de Prisma.

### 18.8 Vérifié sans défaut

SQL brut entièrement paramétré ; aucun `dangerouslySetInnerHTML` ni `eval` ;
badges et rapports PDF échappés, couleur de catégorie validée ; les 27 routes API
contrôlent l'accès (propriétaire, permission ou contenu publié) ; CSP à nonce et
politique verrouillée des SVG déposés ; redirection après connexion confinée au
site ; aucun secret dans l'historique git ; URL en `.png` sans contournement du
middleware (404, ou redirection posée par la page) ; liens magiques de 256 bits,
stockés en empreinte ; sessions participant et intervenant non interchangeables ;
synchronisation du scanner validée et bornée.

**Écarté après mesure** : une course sur le compteur d'échecs de connexion,
soupçonnée à la lecture (lecture puis écriture). Vingt tentatives parallèles ont
verrouillé le compte à exactement cinq échecs.

### 18.9 Incident : 393 fichiers repassés en CRLF

La première vérification complète a fait échouer un test unitaire que ce chantier
ne touchait pas : `palette.test.ts` cherchait `h1,\n  h2` dans `globals.css`, qui
contenait désormais des `\r\n`.

**Cause établie par l'historique git** : à 13 h 04, une tentative de commit a
indexé 445 fichiers ; le hook `pre-commit` (husky → lint-staged) a échoué et, à
13 h 07, lint-staged a restauré l'arbre de travail par deux `git reset`. Git pour
Windows ayant `core.autocrlf=true`, la restauration a réécrit **393 fichiers texte
en CRLF** (402 fichiers portent l'heure de 13 h 07 ; les 10 autres sont des images,
dont les octets `\r\n` sont d'origine). Aucun commit n'a été créé, et la sauvegarde
de lint-staged est restée dans `stash@{0}`.

**Rien n'a été perdu** : entre cette sauvegarde et l'arbre de travail, fins de
ligne ignorées, les seuls écarts sont les correctifs du §18. Les images, reconnues
comme binaires par Git, n'ont pas été modifiées.

**Rétablissement** : les 393 fichiers texte ont été remis en LF — contrôle octet
par octet : seul le retour chariot disparaît — et `.gitattributes` impose désormais
`* text=auto eol=lf`, pour que Git écrive du LF sur ce poste quelle que soit sa
configuration. L'index (les 445 fichiers indexés) et la sauvegarde `stash@{0}`
n'ont pas été touchés.

Les fichiers ayant changé d'octets, l'image a été reconstruite, pour que l'image
vérifiée soit exactement celle de l'arbre de travail.

### 18.10 Vérification

Deux passes complètes sur l'image de production reconstruite, conteneur **recréé**,
identifiants de l'image et du conteneur identiques, migration appliquée par
`stack.sh`. Seconde passe, sur les fichiers remis en LF : image `62ac302572ff`
(9 min 32 s), 34/34 pages, avertissements inchangés (`bullmq`, `jose`),
`stack.sh etat` : code identique à l'image. L'image embarque bien `nodemailer`
9.1.1 et `mariadb` 3.4.7.

| Contrôle                                                                   | Résultat                                  |
| -------------------------------------------------------------------------- | ----------------------------------------- |
| Typage, lint                                                               | propres                                   |
| Tests unitaires (dont 30 nouveaux : revalidation, code, IP, CSV, 2FA…)     | **469 passés**                            |
| Suite E2E complète (première passe)                                        | **118 passés**, 13 min                    |
| E2E sécurité, administration, inscription, réservation (seconde passe)     | **38 passés**                             |
| nginx de production devant l'application, IP forgée dans les deux en-têtes | 30 acceptées, **5 refusées** (429)        |
| `nginx -t` sur la configuration                                            | valide                                    |
| Données de test restantes                                                  | 0 compte, 0 catégorie, 0 fichier orphelin |
| `pnpm audit --prod`                                                        | 14 → 10 alertes, toutes hors exécution    |

**Chaque faille mesurée l'est à nouveau, corrigée** :

- **Sessions** (`e2e/securite-sessions.spec.ts`) : un agent connecté dans son
  navigateur, désactivé par un administrateur depuis l'écran des comptes, est
  renvoyé vers la connexion ; l'API lui répond 401 ; réactiver le compte ne rouvre
  pas sa session.
- **IP** : le même parcours envoie 35 vérifications de badge en changeant le
  premier élément de `X-Forwarded-For` — 5 sont refusées, contre aucune avant. Le
  test nginx va plus loin : les deux en-têtes forgés, la configuration de
  production les écrase.
- **2FA** : la page d'enrôlement renvoie au tableau de bord un compte dont le
  second facteur est actif.
- Le **code à 6 chiffres**, les **CSV** et la **catégorie** sont couverts par des
  tests unitaires sur la vraie base : lien précédent annulé, lien annulé au 5e
  échec, plafond journalier, consommation unique sous requêtes simultanées,
  cellules neutralisées, catégorie retirée refusée.

**À faire avant la mise en ligne** : renseigner les clés Turnstile (§18.6), et
prévenir les utilisateurs du BackOffice qu'ils devront se reconnecter une fois
après le déploiement (§18.1).

## 19. Bandeaux resserrés, badges d'inscription, bande du haut en dégradé (17 septembre 2026)

Trois demandes de forme du commanditaire.

### 19.1 Bandeaux de titre des pages intérieures

**Mesuré avant** : 243 px de haut sur écran de bureau (254 px sur téléphone) pour
un sur-titre, un titre et une phrase. Sur un portable, le contenu de la page
commençait sous la ligne de flottaison.

- `BandeauPage` passe de `py-14` à `py-5`, et porte la classe `bandeau-page`.
- Le titre y est plus petit (`.bandeau-page h1`, 2,15rem au plus contre 2,9rem),
  en restant au-dessus des `h2` de section (1,85rem).
- `EnteteSection` reçoit un paramètre `bandeau`, qui remplace `marge={false}` —
  employé uniquement dans les bandeaux — et resserre sur-titre, icône et phrase.
- Les bandeaux composés à la main (connexion, Mon espace, espace
  intervenant, vérification de badge) posaient une tuile d'icône de 56 px
  au-dessus du titre : elle passe à 40 px, **à côté** du titre. L'icône reste
  décorative (`aria-hidden`), le nom accessible du titre est inchangé. Article et
  session gardent leur composition, marges resserrées.

### 19.2 Promesses de l'inscription en badges

Les trois cartes deviennent **trois badges sur une ligne** (icône et libellé), et
le corps de page passe à un espacement `serre` : le formulaire remonte.

Les phrases d'explication disparaissent. Leur essentiel passe dans les libellés :
« Environ 4 minutes », et surtout « Progression gardée **sur cet appareil** » —
« Enregistré au fil de l'eau », seul, aurait laissé croire à une sauvegarde sur le
serveur. « La logistique n'est demandée qu'aux catégories concernées » n'a plus de
place : le compteur « Étape 1 sur 4 » du formulaire en rend compte. Sur téléphone,
les badges passent à la ligne.

### 19.3 Bande du haut : dégradé de bleus

Dégradé à la manière du bandeau d'ansd.sn : `#0b4f8a` → `#1a66c2` → `#2468c9`,
texte blanc. Le texte défile sur toute la largeur et passe donc sur chaque arrêt :
le plus clair tient **5,39:1**. Un dégradé partant du blanc, comme sur ansd.sn,
aurait rendu le texte illisible à une extrémité. Thème sombre : `#061d36` →
`#0e3d70` → `#12498a`, texte `#e6eef7`, 7,65:1 au plus faible.

**Défaut trouvé en chemin** : la bande utilisait `bg-ticker-bg text-ticker-text`,
mais les jetons `--color-ticker-*` n'avaient jamais été déclarés dans `@theme`.
Tailwind ne générait aucune règle : **la bande était transparente depuis sa
création**, et ni le bleu nuit prévu en thème clair ni le vert du thème sombre
n'ont jamais été affichés. Elle est désormais peinte par une classe dédiée,
`.fond-ticker`, et `palette.test.ts` vérifie que le composant n'emploie plus ces
utilitaires sans effet.

### 19.4 Vérification

Sur l'image de production reconstruite (`a9aff1700fe9`), conteneur recréé,
`stack.sh etat` : code identique à l'image ; 34/34 pages générées.

Mesures dans Chromium, avant → après :

| Mesure                                       | Bureau (1440 px) | Téléphone (390 px) |
| -------------------------------------------- | ---------------- | ------------------ |
| Bandeau Programme, Partenaires, S'inscrire   | 243 → **139 px** | 254 → **153 px**   |
| Bandeau Connexion                            | → 135 px         | → 175 px           |
| Bandeau Vérifier un badge                    | → 110 px         | → 135 px           |
| Haut du formulaire d'inscription             | 586 → **330 px** | 889 → **390 px**   |
| Lignes occupées par les badges d'inscription | → **1**          | → 2                |

La bande du haut porte le dégradé calculé dans les deux thèmes (texte
`rgb(255, 255, 255)` en clair, `rgb(230, 238, 247)` en sombre), et aucune page
mesurée ne déborde en largeur. Captures relues en clair, en sombre et sur
téléphone.

| Contrôle                                                           | Résultat                            |
| ------------------------------------------------------------------ | ----------------------------------- |
| Typage, lint, Prettier                                             | propres                             |
| `palette.test.ts` (dont 4 nouveaux : contraste des arrêts, classe) | 42 passés                           |
| Tests unitaires complets                                           | 472 passés sur 473, voir ci-dessous |
| Suite E2E complète (première image)                                | 119 passés, 1 échec corrigé         |
| Pages touchées, après correction                                   | **54 passés**                       |
| Image finale : apparence, inscription, sécurité                    | **28 passés**                       |

- **L'échec E2E** venait du nouveau test : le bandeau de connexion mesurait
  159 px, au-dessus du plafond de 150. Sa phrase, bornée à 44 caractères de
  large, s'étalait sur trois lignes ; les quatre bandeaux centrés ont été
  élargis à 68 caractères. Connexion : 135 px.
- **Tests unitaires** : deux passes, un échec **différent** à chaque fois, dans
  des modules non touchés — un verrou mortel MySQL dans `access/service.test.ts`,
  puis un compte décalé d'un participant dans `notifications/reminders.test.ts`
  (11 au lieu de 10 : un autre fichier en créait un entre deux lectures). Chacun
  passe seul (5/5 et 7/7). Les fichiers de tests tournent en parallèle sur la
  même base : cette fragilité est antérieure à ce chantier et reste à traiter.
- **Fins de ligne** : un script Python d'édition a réécrit quatre pages en CRLF
  (`write_text` sous Windows). Prettier l'a signalé ; les fichiers ont été remis
  en LF et l'image reconstruite. Aucun fichier texte du dépôt n'est en CRLF.

## 20. En-tête en dégradé, logo officiel, accueil justifié (17 septembre 2026)

### 20.1 Bande du haut et barre de navigation : un même dégradé

La barre de navigation reprend le dégradé de la bande défilante (§19.3) : les deux
portent la classe `.fond-entete` et le **même** dégradé horizontal, et se lisent
comme un seul bloc, la barre restant seule à coller en haut au défilement. Les
jetons sont renommés `--entete-*`. En thème sombre, le texte passe au blanc pur :
8,95:1 au plus faible.

Tout ce qui est posé sur ce bleu a été repris, contraste mesuré :

- **Texte blanc sans voile clair.** Un fond blanc à 10 % sous le texte le fait
  tomber à 4,46:1 sur l'arrêt le plus clair (#2468c9), sous le seuil. Liens et
  boutons sont donc transparents, bordés de blanc, et le survol **assombrit**
  (`bg-black/15`). La rubrique courante du menu se marque par ce même fond
  assombri, un texte bleu y étant illisible.
- **Contour de focus blanc.** L'or du reste du site ne tient que 1,6:1 sur ce
  bleu, sous le seuil de 3:1 exigé pour un indicateur de focus ; le blanc tient
  5,39:1. Les menus déroulants et le panneau mobile, sur fond clair, gardent l'or.
- **Liseré blanc sur « S'inscrire ».** Le vert du bouton et le bleu clair du
  dégradé ont presque la même clarté (1,23:1) : le bouton se fondait dans le
  fond pour qui distingue mal les couleurs.
- `LocaleSwitcher` et `ThemeToggle` prennent une `variante` (`entete` sur le
  dégradé, `panneau` dans le menu mobile, sur fond clair). Langue active en
  pastille blanche, texte bleu nuit : 14,18:1.

### 20.2 Logo officiel

`public/images/logo_forum.jpg` (2 560 × 1 210 px, 254 Ko) a été rogné de ses marges
blanches et réduit à 180 px de haut : `logo-forum.webp`, 399 × 180 px, **19 Ko**,
net jusqu'aux écrans 3x. L'original est conservé.

Il remplace la pastille dessinée et le nom écrit, dans l'en-tête (44 px de haut) et
dans le pied de page (56 px). Le logo porte un texte bleu sur fond blanc :
**toujours sur une pastille blanche**, choix validé par le commanditaire. Le
détourer aurait aussi rendu transparents les blancs du dessin (anneau du globe,
intérieur du « O »). Dans l'en-tête, l'image est décorative (texte alternatif vide) : le
lien porte le nom « Forum international sur les données — accueil ». Dans le pied
de page, son texte alternatif restitue le nom.

`next/image` en mode `unoptimized` : le fichier est déjà à sa taille, et
l'optimiseur ajouterait une dépendance d'exécution (`sharp`).

**Remplacé ensuite** par la version transparente fournie par le commanditaire,
`public/images/logo_forum_transparent.png` (4 460 × 2 000 px, 1,48 Mo), **sans
pastille** dans l'en-tête. À noter : le fichier pèse 1,48 Mo et se charge à chaque
page pour un affichage de 44 px de haut. `logo-forum.webp` n'est plus utilisé.

**Barre de navigation passée au bleu clair.** Transparent, le logo était illisible
sur le dégradé foncé de la barre. Celle-ci prend un dégradé bleu clair
(`#e6f1fb` → `#d9eaf7`, classe `.fond-navbar`), de la famille de l'océan du globe
du logo (`#90c0d8` à `#b8d8e8`) mais plus pâle, pour que le globe s'en détache. La
bande défilante garde son dégradé foncé.

- Texte bleu du logo : 5,86:1 au plus faible ; liens et boutons en **bleu nuit**
  (11,52:1), contour de focus bleu nuit (l'or n'y tient que 2,73:1), survol
  éclairci (`bg-white/60`). Le liseré blanc de « S'inscrire » est retiré : le vert
  s'y détache à 3,93:1.
- Couleurs fixes, et non jetons de thème : **la barre reste claire en thème
  sombre**, le logo portant un texte bleu et une devise noire.
- **Pied de page** : le logo transparent y est posé **à même le fond bleu nuit**,
  à la demande du commanditaire. Une plaque bleu clair avait été essayée, puis
  retirée. Le texte bleu du logo y est donc peu contrasté ; le nom du Forum reste
  porté par le texte alternatif de l'image, et par le titre de chaque colonne.

Ces derniers changements n'ont été ni reconstruits ni passés en E2E. Vérifiés :
typage, lint, `palette.test.ts` (45 passés, dont la barre bleu clair).

### 20.3 Titre et chapeau de l'accueil : un seul bloc, chapeau justifié

Le commanditaire a demandé un alignement justifié pour le titre et le chapeau du
bandeau d'accueil, puis que le titre occupe toute la largeur du bloc, quitte à le
centrer.

- **Un seul bloc**, de la largeur du chapeau (54 caractères de sa police). Le titre
  était borné à 16 caractères de la sienne et s'arrêtait à **427 px pour un
  chapeau de 524** : il remplit désormais le bloc et s'aligne sur ses deux bords.
- **Chapeau justifié**, et coupé selon la langue de la page (`hyphens-auto`) pour
  limiter les blancs qu'un texte justifié creuse entre les mots. Le rendu est
  régulier en français comme en anglais.
- **Titre centré** dans cette largeur, lignes équilibrées. Il n'est pas justifié :
  essayé, il s'affichait « Reliable⎵⎵⎵⎵⎵⎵data / for⎵⎵⎵⎵⎵⎵decisions » en anglais.
  Avec deux ou trois mots par ligne, la justification n'a qu'un ou deux espaces à
  étirer, et aucune règle CSS ne plafonne cet étirement.

À savoir : la justification est déconseillée par le critère WCAG 1.4.8 (niveau
AAA, non exigé ici), parce que les écarts irréguliers gênent certains lecteurs.
La coupure des mots en atténue l'effet sur le chapeau.

### 20.4 Vérification

Image finale `c1238a23a16b`, conteneur recréé, `stack.sh etat` : code identique à
l'image. Le logo est servi en 200, `image/webp`, 18 780 octets.

| Contrôle                                                                    | Résultat       |
| --------------------------------------------------------------------------- | -------------- |
| Typage, lint, Prettier (tout `src` et `e2e`)                                | propres        |
| Tests unitaires (dont le dégradé et le focus blanc de l'en-tête)            | **475 passés** |
| Suite E2E complète (avant la reprise du bloc titre et chapeau de l'accueil) | **122 passés** |
| Image finale : apparence, accueil, sections, paramètres                     | **27 passés**  |

Mesuré dans Chromium : en-tête de 72 px, logo affiché en 98 × 44 px depuis
399 × 180, liens de la barre en `rgb(255, 255, 255)`, aucun débordement
horizontal. Titre de l'accueil : 427 → **524 px**, les mêmes bords que le chapeau
sur bureau comme sur téléphone (342 px), centré, sur deux lignes en anglais et
trois en français ; chapeau justifié. Captures relues : accueil en français
(clair) et en anglais (sombre), menu déroulant ouvert, contour de focus blanc sur
« Accueil », téléphone avec le menu mobile ouvert, pied de page.

**Écarts de méthode, corrigés.** Deux fichiers écrits par un script Python ont
été abîmés sans bruit :

- un `\b` d'expression régulière est devenu un caractère de retour arrière, et un
  `\s` a perdu son échappement : `palette.test.ts` passait encore, mais vérifiait
  moins. Les doubles barres obliques arrivaient réduites dans le script.
- La correction a été faite octet par octet, puis contrôlée : aucun caractère de
  contrôle ni fin de ligne CRLF dans `src`, `e2e`, `prisma`, `scripts`, `docker` et
  `messages`.

**Remarqué, non traité** (hors demande) : sur la version anglaise, le compte à
rebours affiche encore « jours, heures, minutes, secondes », et les noms de pays
restent en français.

## 21. Envoi des e-mails par le compte Gmail du Forum (18 septembre 2026)

Le commanditaire a créé `forumansd@gmail.com` pour les notifications, les alertes
et les invitations. Le SMTP institutionnel de l'ANSD restant attendu (décision
C7), ce compte sert d'abord aux essais.

Aucun code à changer : tout passe par `src/lib/mail.ts` et ses cinq variables.
`smtp.gmail.com:587`, authentification par **mot de passe d'application** Google —
le mot de passe du compte est refusé en SMTP —, et `SMTP_FROM` portant l'adresse du
compte, faute de quoi Gmail réécrit l'expéditeur. Le port 465 demanderait une
variable `SMTP_SECURE` : `mail.ts` ouvre la connexion en clair puis passe en TLS.

Consigné dans le README (« Envoi des e-mails »), et préparé en commentaire dans
`.env.docker`, hors dépôt : le mot de passe d'application est saisi par le
commanditaire. Tant que Gmail est actif en local, les messages ne passent plus par
Mailpit et **les tests E2E qui l'interrogent échouent**.

**Essai réel, réussi.** Par le parcours public, et non par un envoi bricolé : un
participant temporaire à l'adresse du Forum a demandé son lien de connexion depuis
« Mes inscriptions ». Le journal des notifications l'a marqué **SENT**, avec un
identifiant de message délivré par `gmail.com` (modèle `magic_link`). Le
participant, ses liens et ses traces d'audit ont été effacés ensuite : zéro reste.

Deux enseignements de cet essai :

- **`./scripts/stack.sh` seul ne suffit pas** quand seule la configuration change :
  l'image étant à jour, le script laisse tourner le conteneur existant, avec ses
  anciennes variables. Il faut `--recreer`. Corrigé dans le README.
- **Depuis le poste Windows, l'envoi échoue** (`ENETUNREACH` sur l'adresse IPv6 de
  Gmail) : cette machine n'a pas de route IPv6. Sans incidence pour le portail, qui
  envoie depuis le conteneur.

**Limites à connaître avant la campagne d'invitations** : environ 500 destinataires
par jour sur un compte gratuit, et des rafales que Google peut refuser — le portail
met un message en file par destinataire, sans cadence. Au-delà, il faut le SMTP de
l'ANSD ou un service d'envoi (Brevo, Mailjet, Amazon SES) sur le domaine `ansd.sn`.
Deux ajouts restent possibles : `SMTP_SECURE` pour le port 465, et une cadence
d'envoi dans la file — celle-ci a été faite au §22.

## 22. Campagne d'invitations : envoi groupé et cadence (18 septembre 2026)

Jusqu'ici, l'écran Invitations n'envoyait qu'**une invitation à la fois**, ligne
par ligne. Avec un millier d'invités importés, la campagne était impraticable —
le bouton « Relancer les non-répondants » ne touchant que celles déjà envoyées.

### 22.1 Le bouton

« Envoyer les invitations en attente (N) », à côté de la relance, avec les mêmes
filtres — catégorie, pays — dans un seul formulaire.

- **Seules les invitations jamais envoyées** partent : celles déjà envoyées
  relèvent de la relance, les renvoyer ferait une seconde invitation à des gens
  qui l'ont déjà reçue.
- **Confirmation obligatoire**, qui annonce la cible et la cadence : mille
  courriels partis ne se rappellent pas.
- **Les filtres servent aussi de garde-fou** : lancer la campagne catégorie par
  catégorie est le seul moyen de rester sous le quota quotidien d'une boîte
  d'envoi ordinaire (§21). L'écran le dit sous le bouton.
- Le libellé de la relance devient « Relancer les non-répondants (3 relances
  maximum par personne) » : « max 3 » se lisait comme « trois personnes », alors
  que l'action relance **tous** les non-répondants du filtre.

### 22.2 La cadence

`ENVOIS_PAR_MINUTE = 20` : chaque message est programmé trois secondes après le
précédent (`momentEnvoi`, fonction pure, testée). Mille invitations s'écoulent
donc en cinquante minutes au lieu de partir en rafale, ce qu'une boîte d'envoi
refuse en bloc — sans qu'on sache lesquelles sont passées. La durée est annoncée
à l'agent après le clic.

### 22.3 Un défaut trouvé par le premier test

Le test de la campagne a **dépassé les 30 secondes**, sur les 1 013 invitations
en attente de la base. Cause : un job **et** une ligne d'audit par destinataire,
soit plus de deux mille écritures dans une seule requête. Un agent aurait vu
l'écran se figer, puis la requête échouer.

Deux corrections :

- **`enqueueMany` ajouté à la file** (`JobQueue`) : `createMany` d'une seule
  écriture côté base, `addBulk` d'un seul aller-retour côté Redis. Les deux
  implantations respectent l'idempotence — clé unique en base, `jobId` côté
  BullMQ.
- **Une trace d'audit par campagne**, et non par destinataire : mille lignes pour
  un seul geste noieraient le journal, que l'on consulte pour retrouver qui a
  lancé quoi. La relance en écrit une aussi (`invitation.reminders_queued`), qui
  manquait après ce déplacement.

Mesuré ensuite : **mille invitations mises en file en moins de dix secondes**,
vérifié par un test qui échouerait si le défaut revenait.

### 22.4 Vérification

Sur l'image reconstruite (9 min 17 s), conteneur recréé, `stack.sh etat` : code
identique à l'image. Conteneur repassé sur **Mailpit** avant les tests : sans
cela, la suite aurait envoyé de vrais courriels par le compte Gmail (§21).

| Contrôle                                                        | Résultat       |
| --------------------------------------------------------------- | -------------- |
| Typage, lint, Prettier                                          | propres        |
| Tests unitaires (dont cadence et campagne de mille invitations) | **481 passés** |
| Suite E2E complète                                              | **124 passés** |
| Données de test restantes                                       | aucune         |

Le parcours E2E lance une campagne depuis le bouton, sur **sa propre catégorie** :
confirmation annonçant la cadence, message « 2 invitation(s) mise(s) en file »,
une seule trace d'audit, et les invitations déjà envoyées écartées du second
essai.

**Deux incidents pendant la vérification**, sans rapport avec la fonction :

- **Le poste s'est endormi** au milieu de la première suite : le maintien
  d'éveil couvrait 50 minutes, la série en a duré 118 à cause des veilles
  elles-mêmes. Dix tests ont échoué sur des erreurs réseau (`ERR_ABORTED`),
  confirmées par le journal Windows (sorties de veille moderne à 17 h 07,
  17 h 23 et 17 h 57). Relancée avec un maintien de deux heures : **124 passés
  en 15 minutes**.
- **Le nouveau test créait sa catégorie inactive** : le formulaire d'envoi ne
  propose que les catégories actives, et la sélection échouait sur « did not find
  some options ». Catégorie créée active, placée en fin de liste, supprimée
  ensuite.

**Ce que les tests des files ne peuvent pas casser** : `vitest.setup.ts` donne à
chaque processus de test sa propre file Redis (`forum-ansd-test-<pid>`), qu'aucun
worker de l'application ne consomme. Vérifié à cette occasion, alors que le
premier test avait mis en file de vraies invitations pendant que la stack tournait
sur Gmail : aucun envoi n'est parti, aucun statut n'a bougé. Les 7 112 clés
laissées par ces files de test ont été supprimées de Redis.

## 23. Second facteur par e-mail, en remplacement du TOTP (18 septembre 2026)

Demande du commanditaire, après deux mises en garde écrites : le second facteur
des comptes BackOffice n'est plus une application d'authentification, mais une
**validation par e-mail**.

**Ce que disent les deux documents.** Le cahier des charges de l'ANSD (§26,
Sécurité) demande « authentification à deux facteurs pour les administrateurs »,
sans imposer de méthode : il reste respecté. C'est le **brief** (§7, §2) qui
imposait le TOTP ; ce point s'en écarte, et c'est consigné ici.

**Ce que ce facteur vaut, et ce qu'il ne vaut pas.** La boîte mail de la personne
devient la clé du BackOffice : qui y accède entre. Le TOTP, lui, tenait dans un
téléphone, hors ligne. De plus, un SMTP en panne empêche désormais toute connexion
administrateur — les rôles opérationnels (accueil, scanner) n'étant pas soumis au
second facteur, l'accueil du jour J n'en dépend pas.

### 23.1 Le parcours

1. Adresse et mot de passe. S'ils sont bons et que le rôle est soumis au facteur,
   la réponse n'est pas une session mais « un code vous a été envoyé ».
2. Le message porte un **code à 6 chiffres**, à saisir dans la même fenêtre, et un
   **lien de validation**, pour qui lit son courrier sur un autre appareil.
3. Le code ou le lien ouvre la session.

Le formulaire ne se vide pas entre les deux étapes : l'envoi passe par
`useSoumissionSansRemiseAZero`, sans quoi React 19 effacerait l'adresse et le mot
de passe au premier retour.

### 23.2 Les garde-fous

- **Dix minutes** de validité, **un seul usage**, consommation atomique : deux
  requêtes simultanées ne peuvent pas ouvrir deux sessions avec le même code.
- **Une demande annule la précédente** : un seul code valide à la fois, sans quoi
  chaque demande ajouterait une chance de deviner.
- **Cinq essais** par demande, puis le code est annulé ; chaque code faux compte
  comme un échec de connexion, donc verrouille le compte au cinquième comme cinq
  mots de passe faux.
- **Trois demandes par minute** et par compte : le formulaire ne sert pas à inonder
  une boîte.
- Le **jeton du lien** est stocké en empreinte SHA-256 : une fuite de la base ne
  donne pas de lien valide. Le code, lui, ne vit que le temps de la demande.
- La page du lien **ne valide pas au chargement** : la validation part d'un envoi
  de formulaire. Les antivirus de messagerie et les aperçus de liens visitent les
  URL des messages ; une validation sur simple visite aurait consommé le jeton
  avant son destinataire.

### 23.3 Ce qui disparaît

L'écran d'enrôlement `/admin/2fa/enroll`, la redirection du middleware qui
l'imposait, le bouton « Détacher le 2FA » de l'écran des comptes, `src/lib/totp.ts`
et la dépendance `otplib`. Les colonnes `User.totpSecret` et `User.totpEnabled`
sont **conservées** le temps de valider le nouveau facteur en production, mais plus
lues par le code : les supprimer effacerait des secrets qu'on ne peut pas
reconstituer si l'on revenait en arrière.

Nouvelle table `AdminLoginChallenge`. Le modèle de message `admin_login_code` est
posé par le seed **et** par la migration : sans lui, plus personne ne se connecte
au BackOffice, et une base existante ne rejoue pas le seed.

### 23.4 Pas de plafond journalier, et pourquoi

Le lien magique des participants plafonne à 3 par minute **et** 10 par jour. Ici,
seule la minute compte. Un plafond journalier se retournerait contre le compte
qu'il protège : qui détient déjà le mot de passe pourrait l'épuiser en une minute
et fermer le BackOffice à son titulaire pour la journée. Sans plafond journalier,
le même attaquant ne peut qu'encombrer une boîte mail — gênant, mais réversible,
et visible dans le journal d'audit (`auth.second_facteur_envoye`).

### 23.5 Ce que la vérification a trouvé

La suite E2E a **échoué 51 fois sur une seule cause**, au premier envoi du
formulaire : la page répondait « Code incorrect ou expiré » sans avoir jamais
envoyé de code. `signIn` d'Auth.js sérialise ses options en `URLSearchParams`,
où une valeur `undefined` devient le **texte** « undefined »
(`new URLSearchParams({ code: undefined }).toString()` → `code=undefined`, mesuré
en Node). Le fournisseur recevait donc un code non vide à chaque fois. Le champ
part désormais toujours en chaîne, vide quand il n'est pas rempli.

Ce défaut ne pouvait pas apparaître dans les tests unitaires, qui appellent
`authenticateUser` directement : il vivait à la frontière entre l'action et
Auth.js. C'est la suite E2E, sur l'image de production, qui l'a mis au jour.

La correction faite, la suite est retombée sur un second mur, mais côté tests
cette fois : quinze échecs sur « Trop de demandes de code ». La suite ouvre plus
de cent sessions d'administration sur **un seul compte**, soit environ quatre par
minute — le plafond de trois par minute faisait son travail. Le produit n'a pas
bougé : c'est le parcours de test qui traverse désormais le second facteur une
fois, puis réinjecte les cookies obtenus dans les contextes suivants
(`e2e/helpers/comptes.ts`). Les deux chemins du facteur gardent leurs tests
dédiés, et une session caduque refait le parcours complet. La suite y gagne au
passage : 125 tests en 8 minutes contre 24 auparavant.

**Vérification finale** : 480 tests unitaires (46 fichiers), 125 tests E2E, tous
passés sur l'image de production `fb659ea30e41`, conteneur recréé et identité
d'image vérifiée. Aucune demande de connexion ne reste ouverte en base.

## 24. Le Forum change de lieu : Hôtel King Fahd Palace, Dakar (21 septembre 2026)

Le brief (§1) et le cahier des charges situent le Forum au CICAD de Diamniadio.
Le commanditaire annonce le 21 septembre que les trois journées se tiendront à
l'**Hôtel King Fahd Palace, Route des Almadies, à Dakar**. Les dates ne bougent
pas.

### 24.1 Où le lieu était écrit

| Où                                            | Quoi                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Edition.venue` (base)                        | bandeau des pages, en-tête du programme, tableau de bord du BackOffice, bandeau d'accueil |
| `ContentBlock practical.*` (base)             | les six cartes d'infos pratiques, FR et EN                                                |
| `NotificationTemplate reminder_j7/j1` (base)  | rappels J-7 et J-1, FR et EN                                                              |
| `prisma/seed.ts`                              | les mêmes textes, pour une installation neuve                                             |
| `src/components/site/ticker.tsx`              | bandeau défilant, écrit en dur                                                            |
| `README.md`, `docs/guide-agents-accueil.html` | en-têtes de documents                                                                     |

Et nulle part ailleurs : ni badge, ni PDF, ni salle, ni session ne porte le lieu
— vérifié table par table avant d'écrire quoi que ce soit.

### 24.2 Une migration de données, pas un seed rejoué

`edition.upsert` a un `update: {}` : rejouer le seed ne corrige **pas** une base
déjà en service. Le changement passe donc par une migration
(`20260921090000_lieu_king_fahd_palace`), qui a deux propriétés :

- chaque mise à jour est **conditionnée à l'ancien texte** — un contenu déjà
  corrigé depuis le BackOffice n'est pas écrasé ;
- les rappels sont modifiés par `REPLACE` sur la seule mention du lieu, ce qui
  laisse intacts la date, les consignes de badge et la signature.

Le serveur de l'ANSD l'appliquera au prochain déploiement, sans intervention.

### 24.3 Ce que le portail n'affirme plus

Trois phrases décrivaient le CICAD et sont devenues fausses aux Almadies : « à 15
minutes du CICAD », « hôtels partenaires à Diamniadio », « gare TER de Diamniadio
à proximité ». Elles n'ont pas été remplacées par d'autres chiffres inventés :
faute de pouvoir vérifier le temps de trajet depuis l'AIBD, **la durée
disparaît** au lieu d'être remplacée par une estimation. Les trois textes
retenus, choisis par le commanditaire, annoncent l'aéroport et les navettes des
délégations, les tarifs négociés au King Fahd Palace et dans des hôtels
partenaires de Dakar, et les navettes hôtels ↔ site avec le parking.

### 24.4 Vérification

Image de production reconstruite (`e72c3fcf29df`, conteneur recréé, identité
d'image vérifiée), migration appliquée. En base : zéro mention résiduelle de
CICAD ou de Diamniadio dans les contenus comme dans les modèles de message. Sur
les pages servies (`/`, `/infos-pratiques`, `/programme`) : le nouveau lieu, zéro
ancienne mention, accents intacts (`U+00F4` pour le « ô » d'Hôtel).

## 25. Une section ajoutée n'apparaissait pas sur le site (21 septembre 2026)

Trouvé en vérifiant le changement de lieu : trois tests de bout en bout
échouaient, tous sur la même propriété — une section créée depuis le BackOffice
ne se voyait pas sur la page d'accueil. Ils passaient encore en §22.

### 25.1 Ce que la mesure a montré

Le défaut n'était ni dans l'écriture ni dans le rendu :

- une **sonde en base**, lancée pendant le test, a vu la ligne arriver
  correctement : `page=accueil`, `type=appel`, `isVisible=1`, titre rempli ;
- une section **écrite directement en base** apparaissait sur le site en 15
  secondes, rendue en `<h2>` comme attendu ;
- la même section **enregistrée depuis l'écran** ne paraissait toujours pas après
  **90 secondes** de sollicitations — ni par `fetch` sans cookie, ni par le
  navigateur connecté, ni par le client HTTP des tests ;
- l'en-tête de la page servie (`cache-control: private, no-cache, no-store`)
  établit qu'elle est rendue à chaque requête : le seul cache en jeu était celui
  des données.

Autrement dit, le cache faisait **pire que rien** : sans lui, la lecture aurait
montré la nouvelle section ; avec lui, l'invalidation par étiquette
(`revalidateTag("sections-page")`, pourtant appelée après l'écriture) ne reprenait
pas la main, et la page restait figée bien au-delà des 60 secondes annoncées.

### 25.2 La correction

`sectionsVisibles` lit désormais la base directement, et filtre `isVisible` en
SQL. Le cache et son étiquette disparaissent ; `revalidatePath` reste pour
l'écran du BackOffice, qui, lui, est gardé en cache par Next.

Ce que cela coûte : une requête indexée de quelques lignes, dans une page déjà
rendue à chaque visite. Ce que cela règle : un administrateur qui publie une
section la voit sur le site tout de suite — et ce que promet l'écran redevient
vrai. Les trois tests qui échouaient passent, et le fichier entier tient
désormais en 56 secondes contre 2 min 30 (les échecs coûtaient des attentes de
dix secondes).

### 25.3 Ce que ce défaut apprend sur les autres caches

Les réglages d'apparence et le pied de page utilisent le même mécanisme (T48).
Rien ne prouve pour l'instant qu'ils souffrent du même mal — le test du pied de
page passe, et il est écrit exprès pour traverser l'action serveur plutôt que la
base. Mais la propriété n'est vérifiée que pour lui : c'est à surveiller si un
réglage tarde un jour à s'appliquer.

### 25.4 Un test qui pariait sur le calme de la base

La même vérification a fait tomber, une fois sur deux, le test « ETag stable
entre deux générations identiques » du manifeste du scanner. Le manifeste couvre
**toute l'édition**, et la suite unitaire tourne à plusieurs fichiers de front
sur la même base : comparer deux lectures successives revenait à parier qu'aucun
autre fichier ne crée un badge entre les deux. Le produit n'était pas en cause —
le test seul passait, le test en compagnie échouait.

La propriété visée est que **l'horodatage n'entre pas dans le calcul de l'ETag**,
sans quoi le 304 ne servirait jamais. Elle se vérifie sur une seule lecture dont
on ne change que l'heure, ce qui la met hors d'atteinte des écritures
concurrentes. Suite unitaire : 480 tests, 46 fichiers, verte.

## 26. Éditeur mis en forme partout, et zones de dépôt (21 septembre 2026)

Demande du commanditaire : les zones d'édition des **contenus** et des
**actualités** doivent être les mêmes que celles des sections, et les champs de
fichier doivent devenir des zones de dépôt modernes, partout.

### 26.1 Un seul éditeur pour tout le BackOffice

`EditeurTexteRiche` quitte le module des sections pour `src/components/ui` : il
équipe désormais les douze zones éditoriales et le corps des actualités. Une
personne qui a appris à écrire une section sait écrire une actualité.

Ce qui reste en texte simple, et pourquoi :

- **les titres** (`home.hero.title`) : ils sortent dans un `<h1>`, où une liste à
  puces n'aurait aucun sens ;
- **le chapô d'une actualité** : il part dans la balise `description` de la page
  et dans les aperçus partagés sur les réseaux, où le balisage n'a pas sa place.

C'est la **clé** qui décide, pas le formulaire : chaque zone déclare dans
`keys.ts` si elle est riche et jusqu'où va son texte. La longueur se mesure sur
le texte **visible**, balisage exclu — sans quoi trois mots en gras compteraient
pour cent signes. Le serveur renettoie ce que l'éditeur a déjà nettoyé
(`normaliserBlocContenu`, `normaliserArticle`), parce qu'un champ caché se
falsifie.

Côté public, `TexteRiche` rend les six cartes d'infos pratiques, les mentions
légales, la confidentialité et le corps des articles. Aucun HTML n'est injecté :
une balise tapée à la main s'affiche comme le texte qu'elle est. Les anciennes
valeurs, écrites en texte brut, restent lisibles telles quelles — rien à migrer.

### 26.2 Deux écrans qui ne disaient rien

Trouvés en écrivant le parcours de test : l'écran des contenus **ne confirmait
pas** l'enregistrement, et la création d'une actualité laissait un formulaire
vide, sans un mot. Dans les deux cas, la personne pouvait croire à un échec et
recommencer. L'un annonce maintenant « Zone enregistrée. », l'autre ramène à la
liste des articles.

### 26.3 Les zones de dépôt

Un composant unique, `ZoneDepot`, remplace les `<input type="file">` nus dans
huit écrans : logo de partenaire, termes de référence, contributions, import
Excel, couverture et galerie d'article, illustration de section, présentation et
photo d'intervenant. Il annonce les formats acceptés et le poids maximal —
trois informations que l'on n'avait jusqu'ici qu'après le refus du serveur —,
montre le fichier retenu avec sa taille et un bouton pour le retirer, et accepte
le **glisser-déposer**.

Le champ reste un vrai `<input type="file">`, masqué à l'œil (`sr-only`) mais ni
au clavier ni aux lecteurs d'écran : le formulaire l'envoie comme avant, la
tabulation l'atteint, et les parcours de test qui le visent par son nom n'ont
pas bougé. Le dépôt par glisser se contente de poser les fichiers dans ce champ
puis de déclencher son `change` : un seul chemin d'entrée, donc un seul
comportement à vérifier.

La photo du participant fait exception : son cadrage rond, son zoom et son
appel à la caméra font plus que choisir un fichier. Elle garde son widget, et
gagne seulement le dépôt par glisser.

### 26.4 Ce que la vérification a coûté

Trois passes, et deux défauts **dans les tests** plutôt que dans le produit :

- le parcours de l'actualité attendait l'URL `/admin/contenus/actualites`, que
  la page de création satisfaisait déjà : un refus de l'action passait pour un
  succès ;
- deux exécutions lancées coup sur coup tombaient dans la même minute, et le
  plafond de trois demandes de code (§23) faisait échouer un test sans rapport.
  Le parcours remet ce compteur à zéro avant de se connecter ; la règle, elle,
  garde son propre test unitaire — une quatrième demande dans la minute est
  refusée.

S'y ajoute un effacement de profil Chrome devenu tolérant : sous Windows, le
navigateur garde brièvement des fichiers ouverts après la fermeture du contexte,
et `ENOTEMPTY` faisait tomber un test par ailleurs réussi.

**Vérification** : 480 tests unitaires, **128 tests E2E** (trois nouveaux : un
texte éditorial mis en forme paraît aussitôt sur le site, une actualité s'écrit
avec le même éditeur, un fichier glissé est pris comme un fichier choisi), sur
l'image de production `a4dfe42ffe15`, conteneur recréé et identité vérifiée.

## 27. Déploiement sur le serveur de l'ANSD (21 septembre 2026)

Le portail doit tourner sur un serveur Linux interne (`10.7.200.41`), puis
s'ouvrir au public sur `forum2026.ansd.sn`. Choix arrêtés avec le commanditaire :
recette en interne d'abord, MySQL du compose, construction de l'image sur le
serveur.

### 27.1 Ce que le dépôt gagne

- `docker-compose.interne.yml` : surcouche qui sert en clair sur le port 80 et
  met certbot en veille sous un profil `tls` ;
- `docker/nginx-interne.conf` : le même proxy que la production, sans TLS, et
  avec la même règle d'adresse cliente (`X-Real-IP` écrasée, jamais complétée —
  §18) ;
- un service `outils` dans `docker-compose.prod.yml` ;
- `docs/DEPLOIEMENT.md` : la procédure, de l'installation de Docker à la
  bascule HTTPS, avec la liste de contrôle d'avant-ouverture.

### 27.2 Pourquoi un service « outils »

L'image de production ne contient que le serveur Next compilé : ni la ligne de
commande Prisma, ni `tsx`. `docker compose exec app prisma migrate deploy` aurait
échoué sur un « command not found » difficile à relier à sa cause. Le service
`outils` reprend l'étage `builder`, qui les a, ne démarre jamais avec la pile
(profil `outils`) et vit le temps d'un `run --rm`.

### 27.3 Ce que le HTTP interne coûte

- **Le scanner ne peut pas allumer la caméra** : les navigateurs réservent
  `getUserMedia` aux origines sécurisées. La recherche par nom prend le relais,
  mais une répétition d'accueil suppose la bascule HTTPS.
- Les mots de passe du BackOffice circulent en clair sur le réseau local.

Les deux points sont écrits en tête du document plutôt qu'en note de bas de
page : ce sont eux qui décident du calendrier de la bascule.

### 27.4 Deux pièges désamorcés d'avance

- **Secrets en hexadécimal** : un `$` dans un fichier `.env` est interprété par
  Compose, et un mot de passe amputé de sa fin produit une erreur de connexion
  dont la cause ne saute pas aux yeux.
- **SMTP d'abord** : sans envoi de courriel, plus aucun administrateur ne se
  connecte (§23). Le document donne la commande qui teste le port 587 depuis le
  serveur, avant que la question ne se pose un dimanche soir.

### 27.5 Bascule HTTPS (24-25 septembre 2026) et ce qu'elle a appris

La DSI n'a pas suivi la voie prévue au §5 du guide. Plutôt qu'un certificat
Let's Encrypt propre au portail, elle a déposé le **joker `*.ansd.sn`** du parc,
signé GlobalSign, dans `docker/certs`, et adapté à la main `docker/nginx.conf`
et `docker-compose.prod.yml` sur le serveur. Ces deux fichiers étant versionnés,
le dépôt et le serveur ont divergé sans que rien ne le signale : `git pull`
répondait « Already up to date » tant qu'il n'y avait rien à tirer, et aurait
refusé de s'exécuter au premier vrai correctif. Les modifications sont reprises
ici, et `docker/certs` ajouté au `.gitignore` — le dossier porte la clé privée
du domaine, pas seulement celle du portail.

**Le défaut qui a suivi.** Le certificat posé, le site public fonctionnait et le
BackOffice bouclait. `PUBLIC_BASE_URL` était resté sur `http://10.7.200.41`, et
`docker-compose.prod.yml` en dérive `AUTH_URL`. Auth.js tient cette valeur pour
la seule origine légitime : il renvoyait vers l'IP après connexion et y déposait
son cookie de session, nginx redirigeait cette adresse en clair vers HTTPS sur
l'IP, où le certificat porte le nom de domaine et ne correspond plus.

Ce que l'épisode montre : **un certificat ne suffit pas à changer l'adresse d'un
portail**. Trois choses doivent bouger ensemble — ce que nginx sert, ce que le
DNS résout, et ce que l'application croit être. La troisième est la seule qui ne
produise aucune erreur au démarrage, donc la seule qu'on oublie. La même
variable commande les liens des courriels : laissée sur une adresse interne,
elle fabrique des liens qu'aucun destinataire extérieur ne peut ouvrir, en
silence.

**La date qui compte.** Le joker expire le **20 novembre 2026** ; le Forum se
tient du 23 au 25. Trois jours de retard sur l'événement, sur un certificat que
l'ANSD renouvelle pour tout son parc et que le portail ne commande pas. Sans
remplacement, chaque visiteur reçoit un avertissement de sécurité en pleine page
pendant les trois jours du Forum. C'est le risque d'exploitation le plus sérieux
à ce jour ; il est porté en tête de la liste de contrôle du guide, avec une
échéance au 13 novembre pour garder dix jours de marge.

**Certbot passe sous profil plutôt qu'en commentaire.** La DSI l'avait commenté
sur le serveur. Un service commenté se périme en silence, au fil des versions
d'image et des options qui changent ; sous profil `tls`, il ne démarre pas avec
la pile mais reste une définition que Compose vérifie, et qu'un `run --rm`
réveille le jour où le portail reprendrait un certificat à lui.

**La surcouche interne est devenue un piège.** L'alias `forum` posé pendant la
recette chargeait les deux fichiers Compose. Le passer aujourd'hui remplace la
configuration nginx par celle sans TLS et remet le portail en clair — sans rien
signaler, puisque le port 80 répond et que le site s'affiche. L'avertissement
est écrit en tête de `docker-compose.interne.yml`, là où on le lit avant de
lancer la commande, et non dans le guide seul.
