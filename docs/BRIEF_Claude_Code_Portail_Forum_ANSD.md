# BRIEF TECHNIQUE — Portail Web du Forum international sur les données (ANSD)

> Destinataire : Claude Code
> Rédigé à partir des « Spécifications fonctionnelles proposées » (ANSD), enrichies de décisions techniques, de corrections et de recommandations.
> Langue de l'interface : **français** (anglais en seconde langue). Langue du code et des commentaires : anglais ; textes UI et messages métier : français.

---

## 0. Ce que tu dois construire, en une phrase

Une plateforme web unique — site vitrine public + espace participant + BackOffice de pilotage + application de scan d'accès — pour organiser le **Forum international sur les données** de l'ANSD, **23–25 novembre 2026** à Dakar, qui gère invitations, inscriptions, badges QR sécurisés, réservation des panels, contrôle d'accès par zone, présences quotidiennes, programme, intervenants, sponsors, contributions et reporting.

**Contrainte calendaire dure** : nous sommes début septembre 2026. Les inscriptions doivent ouvrir **début octobre**. Le Forum a lieu dans 12 semaines. Tout ce qui n'est pas dans le Lot 1 (§14) ne doit pas retarder le Lot 1.

---

## 1. Décisions structurantes (à respecter sans les rediscuter)

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                    | Justification                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| D1  | **Le portail est multi-édition** : toute donnée métier est rattachée à une `Edition` (ex. `FID-2026`).                                                                                                                                                                                                                                                                      | L'ANSD réutilisera le portail pour les prochaines éditions ; les Actes du Forum restent consultables après.          |
| D2  | **Séparer « catégorie de participant » et « rôle dans le programme »**. Catégorie = qui est la personne pour l'organisation (VIP, national, international, INS, OI, PTF, sponsor, média, personnel ANSD, prestataire, invité spécial). Rôle = ce qu'elle fait dans une session (modérateur, panéliste, conférencier). Un participant a **une** catégorie et **0..n** rôles. | La spec mélange les deux dans la liste 4.1 ; un panéliste peut aussi être un VIP international.                      |
| D3  | **Le QR code ne contient aucune donnée personnelle** : il encode un identifiant public court + une signature HMAC. Le serveur seul résout l'identité.                                                                                                                                                                                                                       | Exigence explicite de la spec (§6) + loi sénégalaise 2008-12 sur les données personnelles.                           |
| D4  | **L'application de scan est une PWA fonctionnant hors-ligne** avec synchronisation différée.                                                                                                                                                                                                                                                                                | Le Wi-Fi d'un centre de conférences le jour J n'est pas fiable ; le contrôle d'accès ne doit jamais bloquer.         |
| D5  | **Les participants n'ont pas de mot de passe** : accès à « Mes inscriptions » par **lien magique** envoyé par email (validité 30 min) + code à 6 chiffres en secours.                                                                                                                                                                                                       | Zéro friction pour 500+ participants internationaux, zéro support « mot de passe oublié ».                           |
| D6  | **Interface bilingue FR/EN** dès le départ (i18n), français par défaut.                                                                                                                                                                                                                                                                                                     | Forum _international_ ; la spec ne le prévoit pas mais la moitié des invités sont anglophones (INS anglophones, OI). |
| D7  | **Un seul dépôt, un seul déploiement** (monorepo Next.js). Voir §3.                                                                                                                                                                                                                                                                                                         | Équipe réduite, délai court.                                                                                         |
| D8  | **Le badge est un gabarit HTML/CSS** rendu en PDF/PNG côté serveur, paramétrable par catégorie (couleur, mentions, zones).                                                                                                                                                                                                                                                  | Impression instantanée sur imprimante à badges, cohérence numérique/physique.                                        |
| D9  | **Toute écriture sensible passe par un journal d'audit** immuable (`AuditLog`).                                                                                                                                                                                                                                                                                             | Spec §25.                                                                                                            |
| D10 | **Aucune donnée réelle inventée** : les seeds utilisent des données fictives explicitement marquées `[DEMO]`.                                                                                                                                                                                                                                                               |                                                                                                                      |

---

## 2. Corrections et améliorations apportées à la spécification

Points que tu implémentes **tels que décrits ici**, pas tels qu'écrits dans la spec d'origine :

1. **« Bloc / Contributions »** → renommé **« Contributions & Actes »** (le mot « Bloc » est probablement une coquille pour « Blog »). Espace de capitalisation par session : problématique, questions clés, présentations, documents, photos, vidéos (liens YouTube/Vimeo, pas d'hébergement vidéo), synthèse, recommandations ; puis compilation en **Actes du Forum** (PDF généré + page publique).
2. **Formulaire d'inscription** : la spec duplique « Fonction » et « Institution/Organisation ». Un seul champ chacun. Formulaire **multi-étapes** (Identité → Profession → Participation → Logistique → Consentements), sauvegardé en brouillon à chaque étape, avec **champs conditionnels** : la section Logistique (arrivée, départ, hébergement, transport, visa) n'apparaît que pour les catégories internationales ; la photo est facultative à l'inscription, **exigée avant génération du badge** (avec recadrage carré côté client).
3. **Machine à états unifiée des participants** (remplace les deux listes de statuts §5 et §19) :
   ```
   INVITED → INVITATION_SENT → REGISTRATION_STARTED → REGISTERED → CONFIRMED → BADGED → CHECKED_IN
                                                     ↘ DECLINED        ↘ CANCELLED
   ```
   `CONFIRMED` = validé par le comité (validation manuelle ou automatique selon catégorie, paramétrable). `BADGED` = badge généré. `CHECKED_IN` = au moins un scan à l'entrée principale. Les intervenants ont un **statut de rôle** distinct par session : `PRESSENTI → CONTACTE → INVITE → ACCEPTE → CONFIRME → PRESENT`.
4. **Inscription aux panels** : ajouter ce que la spec omet — **contrôle de concurrence** (transaction + verrou de ligne sur la capacité), **détection de chevauchement horaire** (un participant ne peut pas réserver deux sessions parallèles), **liste d'attente avec promotion automatique** et email, **quota réservé par catégorie** (ex. 10 sièges VIP/panel), **date limite de réservation** par session, **annulation par le participant** jusqu'à H-2.
5. **Contrôle d'accès** : ajouter **anti-double-scan** (même badge, même point, < 2 min → « déjà scanné »), **scan de sortie optionnel**, **badges révocables** (perte, fraude) avec réémission (version du badge incrémentée, ancien QR invalidé), et résultat de scan en **3 états visuels** : vert (autorisé), orange (autorisé mais alerte : VIP, première présence du jour, catégorie à accueillir), rouge (refusé : zone non autorisée, badge révoqué, inconnu).
6. **Accès par zone (§15)** : matrice `Catégorie × Zone` paramétrable en BackOffice, avec **exceptions individuelles** (un participant peut recevoir un accès supplémentaire ponctuel).
7. **Délégations** : la spec les cite sans les définir. Une délégation = groupe de participants d'une même institution/pays avec un **chef de délégation** qui peut inscrire ses membres depuis son espace (inscription groupée), voir leurs statuts et télécharger leurs badges.
8. **Tableau de bord** : ajouter un **flux temps réel des scans** (dernières 20 entrées) et une **jauge de remplissage par salle** le jour J.
9. **Programme** : ajouter export **ICS** (ajouter à mon agenda), affichage du fuseau (GMT, Dakar), gestion des **sessions parallèles par salle** (vue grille jour × salle) et bannière « programme modifié » avec notification.
10. **Notifications** : les emails sont **mis en file d'attente** (jamais envoyés dans la requête HTTP), avec **modèles éditables** en BackOffice (variables `{{prenom}}`, `{{lien_badge}}`…), historique d'envoi par participant, et **envoi groupé** (relance des non-répondants avec filtre). SMS : abstraction `SmsProvider` avec implémentation « log » par défaut ; l'intégration d'un agrégateur local se fera en Lot 3.
11. **Vérification publique du badge (§7)** : n'afficher que prénom, nom, organisation, pays, catégorie, validité. **Jamais** email, téléphone, photo. Endpoint limité en débit (rate limit).
12. **Rapports** : générés de façon **asynchrone** pour les gros exports (> 1 000 lignes) avec lien de téléchargement, et **journalisés** (qui a exporté quoi, quand).

---

## 3. Stack technique et architecture

### 3.1 Stack retenue

- **Next.js 15 (App Router) + React 19 + TypeScript strict** — un seul projet pour : site public (SSR, SEO, Open Graph pour partage réseaux sociaux), espace participant, BackOffice, PWA scanner, API (Route Handlers).
- **Base de données : MySQL 8** (contrainte ANSD) via **Prisma** (migrations versionnées, types générés).
- **UI : Tailwind CSS + shadcn/ui** ; icônes `lucide-react` ; tableaux BackOffice avec `@tanstack/react-table` ; formulaires `react-hook-form` + `zod` (schémas partagés client/serveur).
- **Auth BackOffice : Auth.js (NextAuth v5)** credentials + **TOTP 2FA obligatoire pour les rôles admin** ; sessions JWT httpOnly ; participants par lien magique (voir D5).
- **Files/jobs : BullMQ + Redis** (emails, génération de badges en lot, exports, relances). Si Redis n'est pas disponible en production, prévoir un fallback `DbQueue` (table `jobs` + cron) derrière la même interface `JobQueue`.
- **Emails : Nodemailer** (SMTP institutionnel ANSD ou Brevo), templates **React Email**.
- **PDF/PNG : Puppeteer** (badge, liste de présence, actes). Rendu à partir de gabarits HTML.
- **QR : `qrcode`** (génération) ; scan côté client via `@zxing/browser` ou `html5-qrcode`.
- **Fichiers : stockage local `/storage`** derrière une interface `FileStorage` (implémentation S3-compatible prête pour MinIO). Images traitées par `sharp` (photo participant → 600×600 JPEG).
- **i18n : `next-intl`** (FR/EN).
- **Tests : Vitest** (unitaires, règles métier) + **Playwright** (parcours critiques : inscription, réservation panel, scan).
- **Déploiement : Docker Compose** (app, mysql, redis, nginx) + Let's Encrypt. Un `Dockerfile` multi-stage et un `docker-compose.prod.yml` sont livrables.

> **Alternative acceptée** si l'hébergement ANSD n'autorise pas Docker/Next.js : `apps/web` React 18 + Vite + Tailwind (SPA) et `apps/api` Express + TypeScript + Prisma, déployables sous Phusion Passenger. Ne bascule sur cette alternative que sur instruction explicite.

### 3.2 Arborescence cible

```
forum-ansd/
├─ prisma/            schema.prisma, migrations/, seed.ts
├─ src/
│  ├─ app/
│  │  ├─ (public)/           accueil, a-propos, programme, sessions/[slug], intervenants, sponsors, contributions, infos-pratiques, inscription, verifier/[token], actualites
│  │  ├─ (participant)/mon-espace/   badge, mes-sessions, mes-infos, ma-delegation
│  │  ├─ (backoffice)/admin/  dashboard, participants, invitations, delegations, badges, sessions, programme, intervenants, sponsors, contenus, presences, zones, notifications, rapports, utilisateurs, audit, parametres
│  │  ├─ (scanner)/scan/      PWA plein écran (agents d'accueil)
│  │  └─ api/v1/              route handlers REST
│  ├─ modules/               un dossier par domaine : participants/, invitations/, badges/, sessions/, access/, notifications/, content/, reporting/, auth/
│  │  └─ <module>/{schema.ts, service.ts, repository.ts, actions.ts, components/}
│  ├─ lib/                   db, queue, mail, storage, pdf, qr, audit, i18n, rbac
│  └─ components/ui/
├─ storage/                  uploads (gitignored)
├─ docker/  docker-compose.yml, nginx.conf
├─ .env.example
└─ README.md
```

### 3.3 Principes d'implémentation

- Logique métier dans `modules/*/service.ts`, **jamais** dans les composants ni dans les route handlers.
- Toutes les entrées validées par `zod` ; tous les schémas exportés pour réutilisation client.
- Chaque service qui écrit appelle `audit.log({ actorId, action, entity, entityId, before, after })`.
- RBAC déclaratif : `can(user, 'participants.export')` ; la liste des permissions est un enum central (§12).
- Idempotence des jobs (clé d'idempotence sur les envois d'email et les générations de badge).
- Aucune requête N+1 dans les listes BackOffice (utiliser `include`/`select` Prisma ciblés + pagination serveur).

---

## 4. Modèle de données (Prisma — entités et champs clés)

Toutes les tables métier portent `editionId`. Horodatages `createdAt/updatedAt`, suppression logique `deletedAt` sur Participant, Session, Speaker, Sponsor.

| Entité                    | Champs essentiels                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Edition`                 | code (FID-2026), title, theme, startDate, endDate, venue, city, isActive, settings(JSON : validation auto par catégorie, ouverture inscriptions, etc.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `User` (BackOffice)       | email, passwordHash, name, roleId, totpSecret, totpEnabled, isActive, lastLoginAt, failedAttempts, lockedUntil                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `Role` / `Permission`     | Role.name, Role.permissions (JSON string[]) — profils §12                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ParticipantCategory`     | code, labelFr, labelEn, color, badgeTemplateId, autoConfirm(bool), requiresLogistics(bool), sortOrder, isActive                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `Participant`             | publicId (ex. `FID26-7K3M2P`, unique, non séquentiel), civility, firstName, lastName, email(unique/edition), phone, photoPath, locale, jobTitle, organization, organizationType, activityDomain, bio, website, country(ISO), city, categoryId, delegationId, invitationId, status(enum §2.3), participationDays(JSON), attendsOpening, attendsInaugural, attendsAwards, arrivalDate, departureDate, needsAccommodation, needsTransport, dietaryRequirements, specialNeeds, consentTerms, consentData, consentImage, consentAt, source(ONLINE/ONSITE/IMPORT), registeredAt, confirmedAt, confirmedById, notes(interne) |
| `Invitation`              | participantId?, email, firstName, lastName, organization, categoryId, token(unique), status, sentAt, remindersCount, lastReminderAt, openedAt, respondedAt, importBatchId                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Delegation`              | name, country, institution, headParticipantId, maxMembers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Badge`                   | participantId, version, qrToken(hash), generatedAt, generatedById, pdfPath, pngPath, downloadedAt, emailedAt, printedAt, printedCount, revokedAt, revokeReason                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `Zone`                    | code, name, description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `CategoryZone`            | categoryId, zoneId (matrice d'accès)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ParticipantZoneOverride` | participantId, zoneId, grantedById, reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `Checkpoint`              | name, zoneId, deviceLabel, isActive                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ScanLog`                 | participantId?, badgeVersion, checkpointId, agentUserId, scannedAt, day(date), direction(IN/OUT), result(OK/ALREADY/DENIED_ZONE/REVOKED/UNKNOWN), clientScanId(unique, idempotence offline), syncedAt                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `Room`                    | name, capacity, floor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `Session`                 | slug, number, type(OPENING/PLENARY/PANEL/INAUGURAL/AWARDS/BREAK/LUNCH/CLOSING/SIDE_EVENT), titleFr/En, descriptionFr/En, objectives, theme, day, startTime, endTime, roomId, capacity, registrationOpen, registrationDeadline, waitlistEnabled, vipQuota, tdrPath, isPublished, liveStreamUrl                                                                                                                                                                                                                                                                                                                         |
| `Speaker`                 | participantId? (lien facultatif vers un participant), firstName, lastName, jobTitle, organization, country, photoPath, bioFr/En, presentationPath, isPublished                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `SessionSpeaker`          | sessionId, speakerId, role(MODERATOR/PANELIST/KEYNOTE/GUEST_OF_HONOR), confirmationStatus, sortOrder                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `SessionRegistration`     | sessionId, participantId, status(REGISTERED/WAITLISTED/CANCELLED/ATTENDED), waitlistPosition, registeredAt, promotedAt, cancelledAt ; unique(sessionId, participantId)                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `SponsorLevel`            | code, name, sortOrder, logoMaxWidth                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `Sponsor`                 | name, levelId, logoPath, descriptionFr/En, website, videoUrl, standNumber, contactName, contactEmail, isPublished                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Contribution`            | sessionId, type(PROBLEM/OBJECTIVES/KEY_QUESTIONS/PRESENTATION/DOCUMENT/PHOTO/VIDEO/SYNTHESIS/RECOMMENDATION/CONCLUSION), title, body(richtext), filePath, url, speakerId?, isPublished, sortOrder                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Document`                | title, category(TDR/PROGRAM/PRESS/RELEASE/PROCEEDINGS/OTHER), filePath, isPublic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `Post` (actualités)       | slug, titleFr/En, bodyFr/En, coverPath, publishedAt, isPublished                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ContentBlock`            | key (home.hero, home.objectives, practical.visa…), valueFr/En (JSON), updatedById                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `NotificationTemplate`    | key, channel(EMAIL/SMS), subjectFr/En, bodyFr/En, variables(JSON)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `NotificationLog`         | participantId, templateKey, channel, to, status(QUEUED/SENT/FAILED/BOUNCED), providerMessageId, error, sentAt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `MagicLink`               | participantId, tokenHash, code6, expiresAt, usedAt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `AuditLog`                | actorType(USER/PARTICIPANT/SYSTEM), actorId, action, entity, entityId, before(JSON), after(JSON), ip, userAgent, createdAt — **table append-only**                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Job` (fallback queue)    | type, payload, status, attempts, runAt, error                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `Setting`                 | key, value(JSON)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Index à prévoir : `Participant(editionId,status)`, `Participant(editionId,categoryId)`, `ScanLog(day,checkpointId)`, `ScanLog(participantId,day)`, `SessionRegistration(sessionId,status)`, `Invitation(token)`, `Badge(qrToken)`.

---

## 5. Modules — spécifications d'implémentation et critères d'acceptation

### 5.1 Site public

Pages : Accueil, À propos, Programme, Sessions (fiche), Intervenants, Sponsors & partenaires, Contributions & Actes, Actualités, Informations pratiques, Inscription, Vérifier un badge, Connexion (lien discret vers `/admin` et vers `/mon-espace`).

**Accueil** : logos (ANSD + Forum), thème, dates, lieu, compte à rebours (côté client, fuseau Africa/Dakar), présentation, objectifs, **chiffres clés calculés en temps réel** (participants confirmés, sessions publiées, jours, intervenants publiés — mis en cache 5 min), CTA « S'inscrire », « Voir le programme », « Mes inscriptions », « Télécharger mon badge », 3 dernières actualités, carrousel sponsors par niveau, réseaux sociaux. Tout le texte éditable via `ContentBlock`.

Critères : Lighthouse ≥ 90 (perf, accessibilité, SEO) sur mobile ; balises Open Graph par page ; sitemap ; FR/EN via sélecteur ; aucune donnée personnelle exposée.

### 5.2 Invitations

- Import Excel/CSV (`xlsx`) avec **prévisualisation, détection des doublons (email) et rapport d'erreurs ligne par ligne** avant validation. Modèle de fichier téléchargeable.
- Création manuelle, envoi individuel ou groupé de l'email d'invitation avec **lien personnalisé** `/inscription?inv=<token>` qui pré-remplit le formulaire et fixe la catégorie.
- Suivi : ouvert (pixel), cliqué, inscrit, refusé ; **relance des non-répondants** filtrée (catégorie, pays, nb relances) ; limite de 3 relances.
- Un invité qui s'inscrit sans passer par son lien (même email) est **rapproché automatiquement** de son invitation.

Critères : import de 1 000 lignes < 10 s ; aucun envoi synchrone ; test Vitest sur le rapprochement email.

### 5.3 Inscription en ligne

- Formulaire multi-étapes (§2.2), brouillon persistant (localStorage + serveur si email saisi), reCAPTCHA/Turnstile, rate limit, honeypot.
- Détection de doublon : même email → propose le lien magique vers l'espace existant plutôt qu'une nouvelle inscription.
- Après soumission : statut `REGISTERED` ; si `category.autoConfirm` → `CONFIRMED` + badge en file ; sinon email « inscription reçue, en attente de validation ».
- **Espace participant `/mon-espace`** (lien magique) : voir/modifier ses infos (jusqu'à J-3), statut, badge (PDF/PNG), sessions réservées + ICS, membres de délégation (si chef), demande de suppression de compte (RGPD/loi 2008-12).

Critères : Playwright « inscription complète → email reçu (Mailpit en dev) → lien magique → badge visible ».

### 5.4 Badges et QR

- **Token QR** = `publicId` + `.` + `base32(HMAC-SHA256(secret, publicId + version))[0:16]`. Le QR encode l'URL `https://<domaine>/v/<token>` (scannable aussi par un téléphone lambda → page de vérification publique).
- Génération asynchrone (job) : rendu HTML → PNG 1200 px (smartphone) + PDF (format paramétrable : **CR80 85,6 × 54 mm** par défaut, A6 possible) ; stockage ; email « votre badge est disponible ».
- Gabarit par catégorie : couleur de bandeau, mention (VIP, MÉDIA, STAFF…), pictogrammes des zones autorisées, photo, prénom (grand), nom, fonction, organisation, pays (drapeau), publicId lisible.
- BackOffice : génération unitaire/en lot (filtre), régénération, **révocation + réémission** (version+1), impression directe (fenêtre d'impression avec `@page` au format badge), compteur d'impressions, export ZIP des PDF par délégation.
- Wallet (Apple/Google) : **hors périmètre** ; prévoir uniquement l'interface `WalletPassProvider`.

Critères : un QR révoqué scanné → `REVOKED` ; test unitaire de signature/vérification ; génération de 500 badges en lot < 5 min.

### 5.5 Réservation des sessions (panels)

- Page Programme : vue par jour, **grille jour × salle**, filtres (thème, type, salle), badges « ouvert / complet / liste d'attente / clôturé », compteur de places.
- `POST /api/v1/sessions/:id/register` (participant authentifié par lien magique) : vérifications dans une transaction avec `SELECT … FOR UPDATE` sur la session — inscrit au Forum et `CONFIRMED`, session ouverte et avant deadline, pas de chevauchement horaire, pas déjà inscrit, capacité (en tenant compte du `vipQuota` réservé) ; sinon liste d'attente si activée.
- Annulation → promotion automatique du premier en liste d'attente + email.
- BackOffice : inscrire/désinscrire manuellement, exporter la liste par session, **feuille d'émargement PDF** par session, marquer `ATTENDED` (scan à l'entrée de salle ou coche manuelle).

Critères : test de concurrence (20 requêtes simultanées sur 1 place restante → 1 succès, 19 refus/liste d'attente).

### 5.6 Contrôle d'accès — PWA Scanner

- Route `/scan`, installable, plein écran, caméra arrière, sélection du point de contrôle au démarrage, authentification agent (rôle `AGENT_ACCUEIL`), session persistante 24 h.
- **Mode hors-ligne** : au login et toutes les 10 min, téléchargement d'un **manifeste chiffré** (participants `CONFIRMED`+ : publicId, version badge, prénom, nom, organisation, catégorie, zones autorisées, photo miniature 96 px) stocké en IndexedDB ; vérification de signature HMAC **côté client** avec une clé dérivée valable 24 h ; scans mis en file (`clientScanId` UUID) et synchronisés dès retour réseau ; indicateur visuel en ligne/hors ligne et nombre de scans en attente.
- Résultat plein écran vert/orange/rouge (§2.5) avec photo, nom, catégorie, son + vibration ; anti-double-scan ; bouton « Inscription sur place » si inconnu.
- Recherche manuelle (nom/email/publicId) en secours si QR illisible.
- Tableau BackOffice « Présences » : par jour, par point, par zone ; feuille de présence PDF du jour ; taux de présence par catégorie et par pays ; flux temps réel (SSE ou polling 5 s).

Critères : Playwright simulant une perte réseau ; 200 scans hors-ligne resynchronisés sans doublon ; latence scan → feedback < 300 ms.

### 5.7 Inscription sur place (accueil)

Depuis le scanner ou le BackOffice : rechercher (nom, prénom, email, téléphone, institution, publicId) → si trouvé : compléter, valider, générer, imprimer, présence enregistrée en un seul écran ; sinon « Nouvelle inscription » avec **formulaire minimal** (civilité, prénom, nom, organisation, pays, email ou téléphone, catégorie, photo webcam facultative) → participant `CONFIRMED` `source=ONSITE` → badge → impression → présence. Objectif : **< 90 s par personne**.

### 5.8 Programme, sessions, intervenants

- CRUD complet, duplication d'une session, réordonnancement par glisser-déposer, publication/brouillon, gestion des salles.
- Fiche session publique : infos, objectifs, TDR téléchargeable, modérateur, panélistes (photo, fonction, organisation, pays, bio dépliable, présentation), compteur places, bouton d'inscription, lien live stream si renseigné, contributions publiées.
- Intervenants : fiche, statut de confirmation par session, documents, **lien facultatif vers un Participant** (pour badge et présence) ; bouton « Créer le participant depuis l'intervenant ».
- **Espace intervenant** (Lot 2) : via lien magique, l'intervenant peut téléverser sa photo, sa bio et sa présentation.

### 5.9 Sponsors & partenaires

Niveaux paramétrables (Principal, Gold, Silver, Bronze, Institutionnel, Technique, Média), logos redimensionnés, page publique groupée par niveau, stand, vidéo (embed), contact interne non public.

### 5.10 Contributions & Actes

Par session : blocs typés (§4 `Contribution`), éditeur riche (Tiptap), upload PDF/PPTX (≤ 50 Mo, contrôle MIME), photos (galerie), vidéos (embed). Page publique « Contributions & Actes » + **génération des Actes du Forum** en PDF (couverture, sommaire, une section par session : synthèse + recommandations + liste des intervenants) via job.

### 5.11 CMS léger

`ContentBlock` pour chaque zone éditoriale (accueil, à propos, infos pratiques : lieu, accès, hôtels, transport, visas, contacts), Actualités, Documents. Éditeur riche, prévisualisation, historique des 10 dernières versions par bloc.

### 5.12 Notifications

Modèles (clés) : `invitation`, `invitation_reminder`, `registration_received`, `registration_confirmed`, `badge_ready`, `session_registered`, `session_waitlisted`, `session_promoted`, `session_cancelled`, `program_changed`, `forum_reminder_j7`, `forum_reminder_j1`, `session_reminder_2h`, `thank_you`, `magic_link`. Rappels planifiés par cron. Envoi groupé avec filtre et prévisualisation, historique par participant, gestion des bounces. SMS via interface `SmsProvider` (impl. `LogSmsProvider` en dev).

### 5.13 Tableau de bord et rapports

Indicateurs de la spec §13 + répartition par pays (carte ou barres), par catégorie, par institution, entonnoir invitation → présence, courbe d'inscriptions par jour, remplissage des sessions, flux des scans. Rapports listés §23 en **XLSX/CSV/PDF**, exports asynchrones si volumineux, journalisés.

### 5.14 Administration

Utilisateurs BackOffice, rôles/permissions (§12), 2FA, paramètres de l'édition (dates, ouverture/fermeture des inscriptions, validation automatique par catégorie, formats de badge, zones, points de contrôle, textes légaux), journal d'audit consultable et exportable, état des files de jobs.

---

## 6. API REST (`/api/v1`) — conventions

- JSON, pagination `?page&pageSize` (max 200), tri `?sort=field:asc`, filtres explicites, réponses `{ data, meta }` / `{ error: { code, message, details } }`.
- Auth BackOffice par session ; auth participant par cookie de lien magique ; auth scanner par token agent.
- Endpoints publics limités en débit : `/badges/verify/:token` (30/min/IP), `/registrations` (5/min/IP), `/auth/magic-link` (3/min/email).
- Documentation OpenAPI générée (`/api/docs`) en dev.

---

## 7. Sécurité et conformité

HTTPS obligatoire, en-têtes de sécurité (CSP, HSTS, X-Frame-Options), cookies `Secure/HttpOnly/SameSite`, hachage `argon2id`, politique de mot de passe (12+ caractères), verrouillage après 5 échecs (15 min), 2FA TOTP obligatoire pour `SUPER_ADMIN` et `ADMIN_FORUM`, CSRF (Server Actions/tokens), validation `zod` partout, uploads contrôlés (MIME réel via `file-type`, taille, renommage aléatoire, servis hors webroot), protection XSS de l'éditeur riche (sanitize), secrets en variables d'environnement, rotation possible de la clé HMAC des badges (versionnée), sauvegarde MySQL quotidienne (script `backup.sh` + rétention 30 j), logs applicatifs structurés (pino).

**Données personnelles (loi n° 2008-12, CDP Sénégal)** : consentements horodatés, finalité affichée, minimisation (QR, page de vérification), droit d'accès/rectification/suppression depuis l'espace participant, **anonymisation automatique** des participants non essentiels 12 mois après l'édition (job), export des données personnelles du participant à sa demande. La déclaration auprès de la CDP relève de l'ANSD ; l'application doit fournir une page « Politique de confidentialité » éditable.

---

## 8. Performance et robustesse (pic du jour J)

Cible : 1 500 participants, 6 points de contrôle, 2 scans/s en pointe, 300 réservations de panels en 10 min à l'ouverture. Cache des pages publiques (ISR 60 s), index (§4), pool de connexions, compression, images optimisées (`next/image`), healthcheck `/api/health`, graceful shutdown, réessais de jobs (3, backoff exponentiel). Charge testée avec `k6` sur les 3 endpoints critiques.

---

## 9. Accessibilité et responsive

WCAG 2.1 AA sur le site public et le formulaire d'inscription ; navigation clavier ; contrastes ; labels ; BackOffice utilisable sur tablette ; scanner optimisé smartphone (boutons ≥ 48 px, mode lumineux fort).

---

## 9 bis. Direction visuelle et gabarit de référence

Le fichier **`Template_final_Forum_ANSD_clair_sombre.html`** (livré avec ce brief) est le gabarit de référence. Reproduis-le fidèlement en composants React/Tailwind — il n'est pas indicatif, il est prescriptif.

- **Design tokens** : reprends les variables CSS de son `:root` et de `[data-theme="dark"]` telles quelles dans `tailwind.config` (couleurs sémantiques `bg`, `surface`, `border`, `text`, `heading`, `primary`, `secondary`, `accent-soft`, etc.) et dans `globals.css`. Les couleurs de marque ANSD (`--ansd-bleu #0B4F8A`, `--ansd-bleu-nuit #082C4E`, `--ansd-bleu-vif #2F7FD1`, `--ansd-vert #1F8A4C`, `--ansd-vert-vif #3DBB6E`, `--ansd-or #E9A824`) sont des valeurs approchées : les centraliser pour remplacement par la charte officielle.
- **Thèmes clair / sombre** : bascule via `data-theme` sur `<html>`, préférence système par défaut, choix persistant (cookie côté serveur pour éviter le flash au SSR), bouton dans la barre de navigation. Le **badge** et l'**application de scan** ne changent pas de thème (le badge est imprimé, le scanner est toujours sombre).
- **Typographie** : Sora (titres, chiffres) + Inter (texte), via `next/font`.
- **Éléments signature à conserver** : ticker de chiffres clés sous la barre supérieure ; bloc « live » du hero (compte à rebours + histogramme des inscriptions par pays, animé une seule fois au chargement, désactivé si `prefers-reduced-motion`) ; programme en **grille jour × salle** avec jauges de remplissage ; tableau de bord avec KPIs, jauges par salle, entonnoir et flux des scans ; scanner plein écran avec cadre à coins et résultat vert / orange / rouge.
- **Ce que le gabarit ne montre pas** (à concevoir dans le même système) : invitations, délégations, zones d'accès, contributions & actes, notifications, rapports, utilisateurs, audit, paramètres, espace intervenant, pages d'erreur et états vides.
- Chaque page doit être irréprochable **dans les deux thèmes** : contraste AA vérifié, aucune couleur codée en dur hors tokens.

## 10. Internationalisation

FR par défaut, EN ; détection via `Accept-Language`, sélecteur persistant ; tous les libellés dans `messages/fr.json` / `messages/en.json` ; contenus éditoriaux bilingues (`*Fr/*En`, repli sur le FR si EN vide) ; dates au format local ; emails dans la `locale` du participant.

---

## 11. Environnement, outillage, livrables

- `README.md` : installation, `.env.example` commenté, `docker compose up`, seed, comptes de démo, procédure de déploiement, sauvegarde/restauration, procédure d'urgence jour J (mode dégradé si Redis/SMTP tombent).
- `prisma/seed.ts` : 1 édition, catégories, zones, niveaux sponsors, rôles, 1 super admin, 3 jours × 10 sessions, 25 intervenants, 300 participants `[DEMO]`, modèles de notifications.
- Mailpit en dev, MinIO optionnel.
- Scripts : `db:migrate`, `db:seed`, `badges:generate --all`, `reports:export`, `anonymize:edition`.
- ESLint + Prettier + Husky (lint-staged) + CI GitHub Actions (lint, typecheck, tests, build).
- Conventional Commits ; une PR par module.

---

## 12. Rôles et permissions BackOffice

| Rôle                         | Permissions                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `SUPER_ADMIN`                | tout, y compris utilisateurs, paramètres, audit, éditions                           |
| `ADMIN_FORUM`                | tout sauf gestion des utilisateurs et paramètres système                            |
| `GESTIONNAIRE_PARTICIPANTS`  | participants, invitations, délégations, badges, notifications ciblées               |
| `AGENT_ACCUEIL`              | scanner, présences (lecture), inscription sur place, génération/impression de badge |
| `GESTIONNAIRE_PROGRAMME`     | sessions, programme, salles, intervenants, réservations, contributions              |
| `GESTIONNAIRE_COMMUNICATION` | actualités, contenus, sponsors, documents, envois groupés                           |
| `GESTIONNAIRE_STATISTIQUES`  | tableau de bord, rapports, exports                                                  |
| `LECTEUR`                    | lecture seule partout                                                               |

Permissions atomiques (exemples) : `participants.read/write/delete/export`, `badges.generate/revoke/print`, `sessions.write/registrations.manage`, `scan.use`, `content.write`, `notifications.send_bulk`, `reports.export`, `users.manage`, `audit.read`, `settings.write`.

---

## 13. Hypothèses (à confirmer par l'ANSD ; avance avec ces valeurs par défaut)

- Lieu, thème et identité visuelle : placeholders `[À CONFIRMER]` dans les `ContentBlock` et charte neutre (bleu institutionnel + accent) tant que la charte du Forum n'est pas fournie.
- Validation automatique pour `PERSONNEL_ANSD`, `PRESTATAIRE`, `PARTICIPANT_NATIONAL` ; validation manuelle pour les autres.
- Capacité par défaut d'un panel : 80 ; quota VIP : 10 ; liste d'attente activée.
- Format badge : CR80 paysage ; imprimante à badges compatible impression PDF standard.
- Hébergement : VPS Linux (Ubuntu 24) avec Docker, nom de domaine fourni par l'ANSD.
- SMTP institutionnel ANSD (sinon Brevo) ; pas de SMS en Lot 1.

---

## 14. Plan de réalisation (12 semaines)

| Lot                                    | Échéance                       | Contenu                                                                                                                                                                                                                                                                                                          | Critère de sortie                                          |
| -------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Lot 0 — Socle**                      | S+1 (8 sept.)                  | Monorepo, Prisma + migrations, auth BackOffice + 2FA, RBAC, audit, i18n, layout public/admin, CI, Docker                                                                                                                                                                                                         | `docker compose up` → site vide + admin connecté           |
| **Lot 1 — Ouverture des inscriptions** | **S+5 (5 oct.)**               | Site public (accueil, à propos, infos pratiques, actualités, sponsors), invitations (import, envoi, relances), inscription multi-étapes, espace participant (lien magique), badges QR (PDF/PNG, email), vérification publique, participants/délégations en BackOffice, notifications de base, tableau de bord v1 | Inscriptions ouvertes en production                        |
| **Lot 2 — Programme & jour J**         | S+9 (2 nov.)                   | Programme/sessions/intervenants, réservation des panels + liste d'attente, espace intervenant, zones et matrice d'accès, **PWA scanner hors-ligne**, présences, inscription sur place, impression badges, rapports/exports, rappels planifiés                                                                    | Répétition générale avec 50 badges et 3 points de contrôle |
| **Lot 3 — Capitalisation**             | S+12 (20 nov.) puis post-Forum | Contributions & Actes, génération PDF des Actes, SMS (si agrégateur), anonymisation, améliorations issues des tests                                                                                                                                                                                              | Actes publiés après le Forum                               |

Gel fonctionnel : **16 novembre**. Du 17 au 22 : uniquement corrections, données, tests de charge, formation des agents d'accueil (fournir un guide de 2 pages).

---

## 15. Ordre de travail pour Claude Code

1. Lis ce brief intégralement, puis produis un `PLAN.md` découpant le Lot 0 et le Lot 1 en tâches ; signale toute contradiction avant de coder.
2. Initialise le projet (§3), le schéma Prisma (§4) et les seeds ; fais tourner les migrations.
3. Implémente module par module dans l'ordre du Lot 1, avec tests des règles métier (machine à états, signature QR, rapprochement des invitations).
4. À la fin de chaque module : `pnpm lint && pnpm typecheck && pnpm test && pnpm build` doivent passer ; mets à jour `README.md` et `PLAN.md`.
5. Ne laisse aucun `TODO` silencieux : liste-les dans `PLAN.md` avec une priorité.
6. Textes UI en français soigné (accents, typographie française : espace avant « : » et « ; », guillemets « »), termes anglais dans `en.json`.
