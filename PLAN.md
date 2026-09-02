# PLAN — Portail Web du Forum international sur les données (ANSD)

> Découpage en tâches du **Lot 0 — Socle** et du **Lot 1 — Ouverture des inscriptions**, conformément à l'ordre de travail du brief (§15). Le Lot 2 (Programme & jour J) et le Lot 3 (Capitalisation) seront détaillés à l'approche de leur échéance.
> Référence normative : `docs/BRIEF_Claude_Code_Portail_Forum_ANSD.md`. En cas de divergence avec `docs/Spécifications fonctionnelles proposées.docx`, le brief fait foi.
> État au 2 septembre 2026 : Lot 0 (0.1 à 0.8) complet — voir détail par chantier ci-dessous.
> Réserves à lever avant de considérer le Lot 0 définitivement clos : TODO T14 (parcours de
> connexion/2FA non rejoué dans un vrai navigateur) et un `docker compose up` (dev) explicite.
> Prochaine étape : Lot 1 (§3), dans l'ordre indiqué en tête de cette section.

---

## 0. Contradictions et points à clarifier avant de coder

Conformément à la consigne « signale toute contradiction avant de coder », voici ce qui mérite une décision ou une confirmation. Faute de retour de l'ANSD, j'avance avec la **colonne « Décision par défaut »** — à corriger si elle ne convient pas.

| #   | Sujet                                      | Constat                                                                                                                                                                                                                                                                                  | Décision par défaut (si aucun retour)                                                                                                                                                                                                                                                                                                                                             | Priorité              |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| C1  | **Calendrier Lot 0 très serré**            | Le Lot 0 (§14) doit livrer monorepo + Prisma + auth 2FA + RBAC + audit + i18n + layout + CI + Docker pour le **8 septembre**, soit 6 jours à partir d'aujourd'hui.                                                                                                                       | Le Lot 0 est traité **intégralement**, sans restriction de périmètre : les huit chantiers 0.1 à 0.8 sont tous requis, pas seulement le chemin minimal « site vide + admin connecté ». Si le calendrier se révèle intenable en cours de route, je le signalerai explicitement à ce moment-là plutôt que de décider maintenant, par anticipation, de retirer des éléments du Lot 0. | Haute                 |
| C2  | **Session participant après lien magique** | Le modèle de données (§4) définit `MagicLink` (jeton à usage unique, 30 min) mais aucune table de session participant. Or l'espace `/mon-espace` doit rester accessible plusieurs jours (§5.3 : « modifiable jusqu'à J-3 »).                                                             | Après consommation du lien magique, émission d'un **cookie de session JWT httpOnly** (dans le même style que la session admin), signé, à expiration glissante (ex. 30 jours), stocké côté client uniquement — pas de nouvelle table. Le `code6` de secours suit la même logique.                                                                                                  | Haute                 |
| C3  | **Identité visuelle et logos réels**       | Logos ANSD/Forum, charte officielle non fournis (§13 : « placeholders [À CONFIRMER] »).                                                                                                                                                                                                  | Utiliser le bloc-marque géométrique du template (`.brand .mark`) comme placeholder vectoriel, variables `--ansd-*` centralisées dans `src/app/globals.css` (Tailwind v4 est CSS-first, pas de `tailwind.config.ts`) pour remplacement en un point unique.                                                                                                                         | Moyenne               |
| C4  | **CAPTCHA / anti-bot**                     | §5.3 impose reCAPTCHA/Turnstile mais aucune clé n'est fournie.                                                                                                                                                                                                                           | Interface `CaptchaProvider` avec implémentation `NoopCaptchaProvider` par défaut en dev (toujours valide) ; le rate-limit + honeypot restent actifs indépendamment. Clé Turnstile à brancher dès réception par l'ANSD.                                                                                                                                                            | Moyenne               |
| C5  | **Services dev vs prod dans Docker**       | §3.1 liste `docker-compose.yml` (app, mysql, redis, nginx) ; §11 mentionne Mailpit en dev et MinIO optionnel, non listés dans le compose.                                                                                                                                                | `docker-compose.yml` (dev) = app, mysql, redis, mailpit, minio (optionnel, profil `storage`) ; `docker-compose.prod.yml` = app, mysql, redis, nginx, sans mailpit/minio (SMTP et storage réels).                                                                                                                                                                                  | Basse                 |
| C6  | **Hébergement / nom de domaine**           | §13 : VPS Ubuntu 24 + Docker, domaine fourni par l'ANSD — non reçu à ce jour.                                                                                                                                                                                                            | Développement et Lot 1 avancent en local/staging avec domaine provisoire (`*.localhost` / sous-domaine de test) ; le passage en production Lot 1 (§14 : « Inscriptions ouvertes en production ») reste bloqué tant que l'hébergement définitif n'est pas fourni. **Ceci est un vrai risque de calendrier**, à signaler à l'ANSD dès que possible.                                 | Bloquante (hors code) |
| C7  | **SMTP institutionnel**                    | §13 : SMTP ANSD ou repli Brevo — aucun des deux configuré.                                                                                                                                                                                                                               | Développement avec Mailpit ; prévoir la variable d'environnement `SMTP_*` documentée dans `.env.example`, à renseigner avant mise en production.                                                                                                                                                                                                                                  | Moyenne               |
| C8  | **`next-auth` v5 encore en bêta**          | Le brief demande explicitement « Auth.js (NextAuth v5) » (§3.1). Au moment de l'implémentation, le paquet `next-auth` n'a **aucune version 5 stable publiée** — seule une bêta (`5.0.0-beta.32`) existe, la balise `latest` pointant toujours vers la v4 (moins adaptée à l'App Router). | Utiliser `next-auth@5.0.0-beta.32` comme demandé explicitement par le brief plutôt que rétrograder vers la v4 : cette bêta est largement utilisée en production dans l'écosystème Next.js App Router depuis longtemps. Point à surveiller lors des mises à jour de dépendances (API encore susceptible de changer).                                                               | Moyenne               |

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
- [x] Première migration appliquée (`20260902091756_init`) contre MySQL 8 (conteneur Docker de développement, port hôte 3307 — le 3306 est occupé par un autre service MySQL sur la machine).
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
      (`docker/nginx.conf`, domaine `forum.ansd.sn` en placeholder — cf. décision C6).
- [x] `healthcheck` `/api/health` (`src/app/api/health/route.ts`) : vérifie une requête DB réelle.
- [x] `.env.example` commenté (DB, Redis, SMTP, secrets, CAPTCHA, domaine).

**Critère de sortie Lot 0** : les chantiers 0.1 à 0.8 sont tous complets — monorepo, schéma Prisma migré et seedé, auth BackOffice + 2FA + RBAC opérationnels, audit log en place, i18n fonctionnel, layouts public/admin/scanner conformes au template, files/jobs opérationnelles, CI en place, `docker build`/l'image de production démarrent site public + BackOffice avec connexion admin. Réserve : TODO T14 (parcours de connexion non rejoué dans un vrai navigateur) et re-test explicite de `docker compose up` (dev) recommandés avant de considérer le Lot 0 totalement clos — cf. §5.

---

## 3. Lot 1 — Ouverture des inscriptions (échéance cible : 5 octobre 2026)

Ordre recommandé (dépendances) : **1.7 → 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.8 → 1.9**, avec 1.8 (notifications) qui se construit en réalité de façon transverse au fil de 1.2/1.3/1.4/1.5.

### 3.1 Participants & délégations — BackOffice (`modules/participants`)

- [ ] `service.ts` : machine à états unifiée (§2.3) `INVITED → INVITATION_SENT → REGISTRATION_STARTED → REGISTERED → CONFIRMED → BADGED → CHECKED_IN`, branches `DECLINED`/`CANCELLED`. Test Vitest dédié à la machine à états.
- [ ] CRUD participant, validation manuelle (passage `CONFIRMED`), notes internes.
- [ ] Listing BackOffice : recherche, filtres (catégorie/statut/pays), pagination serveur, aucune requête N+1 (`.data` table du template).
- [ ] Délégations : CRUD, chef de délégation, inscription groupée basique, vue membres.
- [ ] Permissions RBAC appliquées (`participants.read/write/delete/export`).

### 3.2 Site public (`app/(public)`)

- [ ] Pages : Accueil, À propos, Programme (vue simple, la grille jour × salle avancée arrive en Lot 2), Intervenants (liste basique), Sponsors, Infos pratiques, Actualités, Inscription (point d'entrée), Vérifier un badge.
- [ ] Accueil : ticker, hero avec compte à rebours (Africa/Dakar), bloc « live » (chiffres clés en cache 5 min : participants confirmés, jours, intervenants publiés — sessions publiées arrivent avec le module Programme en Lot 2), CTA.
- [ ] CMS léger : `ContentBlock` pour zones éditoriales listées (accueil, à propos, infos pratiques), éditeur riche minimal, historique 10 versions.
- [ ] i18n complet FR/EN sur ces pages.
- [ ] Critères : Lighthouse ≥ 90 (perf/a11y/SEO) mobile, Open Graph par page, sitemap, `prefers-reduced-motion` respecté sur les animations (ticker, histogramme).

### 3.3 Invitations (`modules/invitations`)

- [ ] Import Excel/CSV (`xlsx`) : prévisualisation, détection doublons email, rapport d'erreurs ligne par ligne, modèle téléchargeable. Test : 1000 lignes < 10 s.
- [ ] Création manuelle, envoi individuel/groupé via `JobQueue` (jamais synchrone).
- [ ] Lien personnalisé `/inscription?inv=<token>` pré-remplissant catégorie + identité.
- [ ] Suivi : pixel d'ouverture, clic, inscrit, refusé.
- [ ] Relances non-répondants filtrées (catégorie/pays/nb relances), limite 3.
- [ ] Rapprochement automatique par email si inscription hors lien. Test Vitest dédié.

### 3.4 Inscription en ligne (`modules/participants` + formulaire)

- [ ] Formulaire multi-étapes (Identité → Profession → Participation → Logistique → Consentements), schémas `zod` partagés client/serveur.
- [ ] Champs conditionnels : section Logistique affichée uniquement pour catégories internationales.
- [ ] Brouillon persistant (localStorage + serveur dès qu'un email est saisi).
- [ ] `CaptchaProvider` (cf. C4), rate limit `/registrations` 5/min/IP, honeypot.
- [ ] Détection de doublon email → proposition du lien magique plutôt que double inscription.
- [ ] Soumission : `REGISTERED` ; si `category.autoConfirm` → `CONFIRMED` + badge mis en file ; sinon email « en attente de validation ».
- [ ] Photo : facultative à cette étape, recadrage carré côté client si fournie.
- [ ] Test Playwright bout-en-bout : inscription complète → email reçu (Mailpit) → lien magique → badge visible.

### 3.5 Espace participant `/mon-espace` (`modules/auth` côté participant)

- [ ] Flux lien magique : demande → email (validité 30 min) → consommation → **émission du cookie de session** (cf. décision C2) ; code à 6 chiffres en secours.
- [ ] Rate limit `/auth/magic-link` 3/min/email.
- [ ] Vue : infos (modifiables jusqu'à J-3), statut, badge (PDF/PNG), sessions réservées (liste simple, réservation avancée en Lot 2), membres de délégation si chef.
- [ ] Demande de suppression de compte (droit RGPD/loi 2008-12) — déclenche un job de traitement, tracé dans `AuditLog`.

### 3.6 Badges et QR (`modules/badges`)

- [ ] Génération du token : `publicId + "." + base32(HMAC-SHA256(secret, publicId + version))[0:16]` ; secret en variable d'environnement, versionnable. Test unitaire signature/vérification.
- [ ] `publicId` non séquentiel (ex. `FID26-7K3M2P`), généré à la création du participant.
- [ ] Gabarit HTML/CSS par catégorie (reprendre `.badge` du template : bandeau couleur, mention catégorie, photo, nom, fonction, organisation, pays, `publicId`, QR).
- [ ] Génération asynchrone (job) : rendu → PNG 1200px + PDF (CR80 par défaut) → stockage via `FileStorage` → email `badge_ready`.
- [ ] BackOffice : génération unitaire, régénération, révocation + réémission (version+1, ancien QR invalidé), compteur d'impressions (l'impression physique complète et l'export ZIP par délégation restent priorisables en Lot 2 si le temps manque — à signaler dans le suivi).
- [ ] Test : génération de 500 badges en lot < 5 min ; QR révoqué scanné → état `REVOKED`.

### 3.7 Vérification publique du badge (`app/(public)/verifier`, `app/v/[token]`)

- [ ] Endpoint `GET /api/v1/badges/verify/:token`, rate limit 30/min/IP.
- [ ] Page publique : prénom, nom, organisation, pays, catégorie, validité — **jamais** email/téléphone/photo (§2.11).
- [ ] Saisie manuelle de l'identifiant en secours (reprise du composant `.verify` du template).

### 3.8 Notifications de base (`modules/notifications`)

- [ ] Modèles `NotificationTemplate` couvrant a minima les clés utilisées en Lot 1 : `invitation`, `invitation_reminder`, `registration_received`, `registration_confirmed`, `badge_ready`, `magic_link`, `thank_you` (les clés liées au programme/sessions arrivent avec le Lot 2).
- [ ] Éditeur de modèles en BackOffice, variables `{{prenom}}`, `{{lien_badge}}`, etc.
- [ ] Historique d'envoi par participant (`NotificationLog`), gestion des bounces basique.
- [ ] Envoi groupé avec filtre + prévisualisation.
- [ ] `SmsProvider` : interface posée, implémentation `LogSmsProvider` uniquement (pas de SMS réel en Lot 1, conforme §13).

### 3.9 Tableau de bord v1 (`app/(backoffice)/admin`)

- [ ] KPIs disponibles à ce stade (§13) : inscrits, confirmés, invités, internationaux/nationaux, VIP, médias, badges générés, taux global.
- [ ] Répartition par pays / catégorie / institution.
- [ ] Entonnoir invités → envoyées → inscrits → confirmés → badgés (présences J1-J3 arrivent avec le scanner en Lot 2).
- [ ] Courbe d'inscriptions par jour.
- [ ] Flux temps réel des scans : hors périmètre Lot 1 (dépend du scanner, Lot 2) — placeholder visuel uniquement.

### 3.10 Mise en production

- [ ] HTTPS, en-têtes de sécurité (CSP, HSTS, X-Frame-Options), cookies `Secure/HttpOnly/SameSite`.
- [ ] `backup.sh` (sauvegarde MySQL quotidienne, rétention 30 j) + cron.
- [ ] Variables `SMTP_*` réelles renseignées (cf. C7), domaine réel configuré (cf. C6) — **bloquant tant que l'ANSD n'a pas fourni ces éléments**.
- [ ] Vérification manuelle des 3 endpoints à rate limit (`/registrations`, `/auth/magic-link`, `/badges/verify/:token`) sous charge légère avant ouverture publique.
- [ ] Page « Politique de confidentialité » éditable, consentements horodatés vérifiés en base.

**Critère de sortie Lot 1** : inscriptions ouvertes en production, chemin complet inscription → confirmation → badge fonctionnel, BackOffice participants/invitations/délégations opérationnel, notifications de base en file (jamais synchrones), aucune donnée personnelle exposée hors du strict nécessaire sur les pages publiques.

---

## 4. Discipline de fin de module (rappel §15.4)

À la fin de **chaque** module ci-dessus :

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` doivent passer.
2. `README.md` mis à jour (installation, comptes de démo, procédure concernée).
3. Ce `PLAN.md` mis à jour : cases cochées, nouveaux TODO ajoutés au tableau ci-dessous, décisions prises en §0 basculées de « proposée » à « confirmée ».
4. Une PR par module (Conventional Commits).

---

## 5. TODO ouverts (aucun TODO silencieux — §15.5)

| #   | TODO                                                                                                                                                                                                                                                                                                                                                                                                                        | Priorité  | Lot                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------- |
| T1  | Obtenir de l'ANSD : hébergement définitif + nom de domaine (cf. C6)                                                                                                                                                                                                                                                                                                                                                         | Bloquante | Mise en prod Lot 1                  |
| T2  | Obtenir de l'ANSD : identifiants SMTP institutionnel ou confirmation Brevo (cf. C7)                                                                                                                                                                                                                                                                                                                                         | Haute     | Mise en prod Lot 1                  |
| T3  | Obtenir de l'ANSD : logos officiels + charte graphique (cf. C3)                                                                                                                                                                                                                                                                                                                                                             | Moyenne   | Cosmétique, non bloquant            |
| T4  | Obtenir clé Turnstile/reCAPTCHA (cf. C4)                                                                                                                                                                                                                                                                                                                                                                                    | Moyenne   | 3.4                                 |
| T5  | Confirmer la décision de session participant par cookie JWT plutôt qu'une table dédiée (cf. C2)                                                                                                                                                                                                                                                                                                                             | Haute     | 3.5                                 |
| T6  | Impression physique des badges (fenêtre `@page` format badge) et export ZIP par délégation : à confirmer si inclus en Lot 1 ou reporté en Lot 2 selon avancement                                                                                                                                                                                                                                                            | Moyenne   | 3.6                                 |
| T7  | Charge légère sur les 3 endpoints rate-limités avant ouverture publique (k6 complet reporté en Lot 2, cf. §8)                                                                                                                                                                                                                                                                                                               | Basse     | 3.10                                |
| T8  | ~~Le conteneur MySQL de développement était lancé à la main~~ — **résolu** : `docker-compose.yml` (mysql + redis + mailpit + minio) livré en 0.8. Le conteneur `docker run` manuel (port hôte 3307) reste utilisable en parallèle pour du débogage ponctuel.                                                                                                                                                                | —         | 0.8 (fait)                          |
| T9  | Secrets `AUTH_SECRET`/`MAGIC_LINK_SECRET`/`BADGE_HMAC_SECRET` générés aléatoirement pour le `.env` de **développement local** (fait) — à régénérer séparément pour chaque environnement de déploiement, même de test ; ne jamais réutiliser ceux du dépôt/`.env.example`.                                                                                                                                                   | Haute     | Mise en prod                        |
| T10 | Compléter le seed avec 3 jours × 10 sessions, 25 intervenants et 300 participants `[DEMO]` une fois les modules Sessions/Participants disponibles pour leur donner un état cohérent (formulaires, statuts)                                                                                                                                                                                                                  | Basse     | 3.1 / 3.9 (Lot 2 pour les sessions) |
| T11 | Installer Puppeteer et implémenter réellement `src/lib/pdf.ts` (interface posée, lève actuellement une erreur) — différé pour ne pas installer Chromium (~300 Mo) avant le module qui l'exerce                                                                                                                                                                                                                              | Moyenne   | 3.6 (badges)                        |
| T13 | `nodemailer` (9.1.0), `@eslint/eslintrc` (3.3.6) épinglés en version exacte, et `lru.min` forcé à 1.1.4 via `pnpm.overrides` : la politique anti-chaîne-d'approvisionnement de l'environnement de build (`minimumReleaseAge`) rejette les paquets publiés depuis moins de ~24 h. Repasser en plage `^` normale à l'occasion d'une prochaine mise à jour de dépendances, une fois ces versions naturellement plus anciennes. | Basse     | Maintenance continue                |
| T14 | Le parcours interactif complet de connexion BackOffice (formulaire → 2FA → `/admin`) n'a été vérifié qu'au niveau service (tests Vitest) et middleware (redirection HTTP) — pas dans un vrai navigateur, faute d'outil E2E disponible dans cet environnement. À rejouer manuellement (ou via Playwright dès son introduction en Lot 1) avant de considérer 0.3 définitivement clos.                                         | Haute     | 0.3 (vérification)                  |

---

## 6. Hors périmètre explicite de ce plan (rappel)

Programme/sessions complet (grille jour × salle, réservation panels, liste d'attente), zones d'accès et matrice, PWA scanner hors-ligne, présences, inscription sur place, impression de masse, rapports/exports avancés, Contributions & Actes, SMS réel, anonymisation automatique : tout cela relève du **Lot 2** et du **Lot 3** (§14) et sera détaillé dans une mise à jour de ce document à l'approche de leur échéance.
