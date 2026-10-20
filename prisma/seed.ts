/**
 * Seed (brief §11) — installation d'une base **vide**.
 *
 * Deux parties :
 *
 * - les **données de référence**, sans lesquelles le portail ne fonctionne pas :
 *   édition, rôles, catégories, zones et points de contrôle, salles, niveaux de
 *   partenaires, contacts pratiques, modèles d'e-mails, textes par défaut ;
 * - les **données de démonstration** (`prisma/donnees-demo.ts`), seulement sur
 *   demande — `SEED_DEMO=1` ou `pnpm db:seed --demo` — et jamais en production.
 *
 * **Base vide seulement** (19 octobre 2026). Dès qu'une édition existe, le seed
 * s'arrête sans rien écrire. Une base en service est réglée en BackOffice, et
 * même « créer ce qui manque » y recréait ce que le comité avait retiré à
 * dessein : une zone, un modèle d'e-mail, une fiche de démonstration supprimée.
 * Un changement de donnée sur une base existante passe par une **migration**,
 * relue par `prisma/garde-migrations.ts` : elle ne remplit que ce qui est vide.
 *
 * Le code garde ses `upsert … update: {}` de l'époque « création seulement »
 * (1er octobre 2026) : inutiles sur une base vide, ils restent sans risque si la
 * règle venait à être assouplie, et `prisma/seed.test.ts` y veille toujours.
 */
import "dotenv/config";
import argon2 from "argon2";
import { prisma } from "../src/lib/db";
import { estProduction } from "../src/lib/environnement";
import MODELES_PT from "./modeles-pt.json";
import { jobQueue } from "../src/lib/queue";
import { DEFAULT_ROLE_PERMISSIONS } from "../src/lib/permissions";
import {
  cancelParticipant,
  confirmParticipant,
  createParticipant,
  declineParticipant,
} from "../src/modules/participants/service";
import { generateInvitationToken } from "../src/modules/invitations/service";
import {
  ACTUALITES_DEMO,
  bioIntervenantDemo,
  DELEGATIONS_DEMO,
  descriptionSeanceDemo,
  emailIntervenantDemo,
  HOTELS_DEMO,
  INTERVENANTS_DEMO,
  INVITATIONS_DEMO,
  JOURS_DEMO,
  NOTE_PARTICIPANT_DEMO,
  PARTENAIRES_DEMO,
  PARTICIPANTS_DEMO,
  PROGRAMME_DEMO,
  slugSeanceDemo,
  SUPERADMIN_DEMO,
} from "./donnees-demo";
import { decisionSeed } from "./seed-decision";

async function main() {
  const decision = decisionSeed({
    baseInitialisee: (await prisma.edition.count()) > 0,
    demoDemandee: process.argv.includes("--demo") || process.env.SEED_DEMO === "1",
    production: estProduction(),
  });

  if (decision.action === "refus") {
    console.error(decision.message);
    process.exitCode = 1;
    return;
  }
  if (decision.action === "rien") {
    console.log(decision.message);
    return;
  }

  const reference = await seedReference();
  console.log(`Données de référence posées pour l'édition ${reference.edition.code}.`);

  if (decision.demo) {
    await seedDemo(reference);
  } else {
    console.log(
      "Sans données de démonstration : SEED_DEMO=1 (ou --demo) les ajoute, hors production.",
    );
  }
}

/** Données de référence : ce sans quoi le portail ne fonctionne pas. */
async function seedReference() {
  // ---------------------------------------------------------------------
  // Édition
  // ---------------------------------------------------------------------
  const edition = await prisma.edition.upsert({
    where: { code: "FID-2026" },
    update: {},
    create: {
      code: "FID-2026",
      title: "Forum international sur les données",
      titleEn: "International Data Forum",
      theme: "Des données fiables pour des décisions qui comptent",
      startDate: new Date("2026-11-23T00:00:00Z"),
      endDate: new Date("2026-11-25T23:59:59Z"),
      venue: "Hôtel King Fahd Palace",
      city: "Dakar",
      isActive: true,
      settings: {
        registrationsOpenAt: "2026-10-05T00:00:00Z",
        featureFlags: {
          sessionsModule: false,
          scannerModule: false,
          contributionsModule: false,
        },
      },
    },
  });

  // ---------------------------------------------------------------------
  // Rôles BackOffice (§12)
  // ---------------------------------------------------------------------
  const roleEntries = Object.entries(DEFAULT_ROLE_PERMISSIONS);
  const roles: Record<string, { id: string }> = {};
  for (const [name, permissions] of roleEntries) {
    roles[name] = await prisma.role.upsert({
      where: { name },
      // Permissions modifiables en BackOffice : une nouvelle permission arrive
      // par migration, jamais en réécrivant le rôle.
      update: {},
      create: { name, permissions },
    });
  }

  // ---------------------------------------------------------------------
  // Catégories de participants (docx §4.1, corrigées par D2 : les rôles de
  // programme — panéliste, modérateur, intervenant — n'y figurent pas, ils
  // relèvent de SessionSpeaker.role)
  // ---------------------------------------------------------------------
  const categoriesData = [
    {
      code: "AUTORITE_VIP",
      labelFr: "Autorité / VIP",
      labelEn: "Authority / VIP",
      color: "#E9A824",
      autoConfirm: false,
      requiresLogistics: true,
      alertOnScan: true,
      sortOrder: 10,
    },
    {
      // Autorités administratives (29 septembre 2026), sur le modèle des
      // autorités / VIP : validation par le comité, logistique, scan orange.
      code: "AUTORITE_ADMIN",
      labelFr: "Autorités administratives",
      labelEn: "Administrative authorities",
      color: "#6D4C9F",
      autoConfirm: false,
      requiresLogistics: true,
      alertOnScan: true,
      sortOrder: 15,
    },
    {
      code: "PARTICIPANT_NATIONAL",
      labelFr: "Participant national",
      labelEn: "National participant",
      color: "#0B4F8A",
      autoConfirm: true,
      requiresLogistics: false,
      sortOrder: 20,
    },
    {
      code: "PARTICIPANT_INTERNATIONAL",
      labelFr: "Participant international",
      labelEn: "International participant",
      color: "#2F7FD1",
      autoConfirm: false,
      requiresLogistics: true,
      sortOrder: 30,
    },
    {
      code: "INS",
      labelFr: "Institut national de statistique",
      labelEn: "National statistics institute",
      color: "#1F8A4C",
      autoConfirm: false,
      requiresLogistics: true,
      sortOrder: 40,
    },
    {
      code: "ORG_INTERNATIONALE",
      labelFr: "Organisation internationale",
      labelEn: "International organization",
      color: "#3DBB6E",
      autoConfirm: false,
      requiresLogistics: true,
      sortOrder: 50,
    },
    {
      code: "PTF",
      labelFr: "Partenaire technique et financier",
      labelEn: "Technical and financial partner",
      color: "#082C4E",
      autoConfirm: false,
      requiresLogistics: true,
      sortOrder: 60,
    },
    {
      code: "SPONSOR",
      labelFr: "Sponsor",
      labelEn: "Sponsor",
      color: "#E9A824",
      autoConfirm: false,
      requiresLogistics: false,
      sortOrder: 70,
    },
    {
      code: "MEDIA",
      labelFr: "Média",
      labelEn: "Media",
      color: "#C8323A",
      autoConfirm: false,
      // Presse : bouton « Accréditer » au BackOffice, e-mail d'attente dédié,
      // mention « Accréditation presse » sur le badge.
      requiresAccreditation: true,
      requiresLogistics: false,
      sortOrder: 80,
    },
    {
      code: "PERSONNEL_ANSD",
      labelFr: "Personnel ANSD",
      labelEn: "ANSD staff",
      color: "#082C4E",
      autoConfirm: true,
      requiresLogistics: false,
      sortOrder: 90,
    },
    {
      code: "PRESTATAIRE",
      labelFr: "Prestataire de service/Fournisseur",
      labelEn: "Service provider/Supplier",
      color: "#4E5D6B",
      autoConfirm: true,
      requiresLogistics: false,
      sortOrder: 100,
    },
    {
      code: "INVITE_SPECIAL",
      labelFr: "Invité spécial",
      labelEn: "Special guest",
      color: "#E9A824",
      autoConfirm: false,
      requiresLogistics: true,
      alertOnScan: true,
      sortOrder: 110,
    },
  ] as const;

  const categories: Record<string, { id: string }> = {};
  for (const cat of categoriesData) {
    categories[cat.code] = await prisma.participantCategory.upsert({
      where: { editionId_code: { editionId: edition.id, code: cat.code } },
      update: {},
      create: { ...cat, editionId: edition.id },
    });
  }

  // ---------------------------------------------------------------------
  // Zones d'accès (docx §15)
  // ---------------------------------------------------------------------
  /*
   * Trois zones depuis le 24 septembre 2026 (décision du commanditaire) :
   * l'entrée et les deux salles du King Fahd Palace. Les espaces VIP, sponsors
   * et restauration ne sont plus des zones contrôlées — il n'y a plus de point
   * de contrôle à leur entrée, et une zone que personne ne scanne donne
   * l'illusion d'un contrôle qui n'existe pas.
   *
   * Les codes sont stables : ce sont eux que la matrice ci-dessous et les
   * points de contrôle référencent. Ajouter, renommer ou retirer une zone
   * reste possible en BackOffice.
   */
  const zonesData = [
    { code: "ENTREE", name: "Entrée principale" },
    { code: "OUVERTURE", name: "Salle d'Ouverture" },
    { code: "PLENIERE", name: "Salle de Plénière" },
  ] as const;

  const zones: Record<string, { id: string }> = {};
  for (const zone of zonesData) {
    zones[zone.code] = await prisma.zone.upsert({
      where: { editionId_code: { editionId: edition.id, code: zone.code } },
      update: {},
      create: { ...zone, editionId: edition.id },
    });
  }

  /*
   * Le seed supprimait ici les zones absentes de sa liste — y compris celles
   * créées en BackOffice. Retiré le 1er octobre 2026 : le seed ne supprime
   * rien de ce qu'il n'a pas créé dans la même exécution.
   */

  /*
   * Points de contrôle — un par zone (brief §5.6).
   *
   * ## Le défaut que cela ferme
   *
   * Le seed posait les zones et s'arrêtait là. Or un scan se rattache à une
   * porte : sans point de contrôle, le scanner refuse d'enregistrer quoi que ce
   * soit. Une installation neuve livrait donc un scanner qui lisait les QR sans
   * jamais rien inscrire, et la cause n'était visible nulle part — le sélecteur
   * affichait « Aucun point actif », ce qui se lit comme une information et non
   * comme un blocage. Constaté le 25 septembre 2026, sur le serveur de l'ANSD,
   * pendant une répétition d'accueil.
   *
   * ## Ce que ces valeurs sont, et ne sont pas
   *
   * Un point de départ, pas un plan de salle. Le jour J, l'ANSD en ajoutera
   * autant que de portes réellement tenues, avec les libellés d'appareil qui
   * vont avec — tout cela se règle en BackOffice, page des zones d'accès.
   *
   * `isActive` n'est posé qu'à la création : un point désactivé à dessein ne
   * doit pas se rallumer au prochain seed. Le nom sert de clé, faute de
   * contrainte d'unicité sur la table.
   */
  const checkpointsData = [
    { name: "Accueil", zoneCode: "ENTREE" },
    { name: "Porte Ouverture", zoneCode: "OUVERTURE" },
    { name: "Porte Plénière", zoneCode: "PLENIERE" },
  ] as const;

  for (const point of checkpointsData) {
    const existant = await prisma.checkpoint.findFirst({
      where: { editionId: edition.id, name: point.name },
    });
    const donnees = { name: point.name, zoneId: zones[point.zoneCode]!.id };
    if (!existant) {
      await prisma.checkpoint.create({ data: { ...donnees, editionId: edition.id } });
    }
  }

  /*
   * Matrice catégorie × zone — valeurs par défaut, ajustables en BackOffice
   * (brief §2.6).
   *
   * Avec trois zones, presque toutes les catégories ont accès à tout : c'est la
   * réalité d'un forum à deux salles, et le contrôle porte désormais sur
   * l'entrée plus que sur la circulation intérieure. Le prestataire reste
   * l'exception — il entre, il ne s'installe pas dans une séance.
   */
  const allZones = Object.keys(zones);
  const categoryZoneMatrix: Record<string, string[]> = {
    AUTORITE_VIP: allZones,
    AUTORITE_ADMIN: allZones,
    PARTICIPANT_NATIONAL: allZones,
    PARTICIPANT_INTERNATIONAL: allZones,
    INS: allZones,
    ORG_INTERNATIONALE: allZones,
    PTF: allZones,
    SPONSOR: allZones,
    MEDIA: allZones,
    PERSONNEL_ANSD: allZones,
    PRESTATAIRE: ["ENTREE"],
    INVITE_SPECIAL: allZones,
  };

  for (const [categoryCode, zoneCodes] of Object.entries(categoryZoneMatrix)) {
    for (const zoneCode of zoneCodes) {
      await prisma.categoryZone.upsert({
        where: {
          categoryId_zoneId: {
            categoryId: categories[categoryCode].id,
            zoneId: zones[zoneCode].id,
          },
        },
        update: {},
        create: { categoryId: categories[categoryCode].id, zoneId: zones[zoneCode].id },
      });
    }
  }

  // ---------------------------------------------------------------------
  // Salles (brief §5.8)
  // ---------------------------------------------------------------------
  /*
   * Deux salles depuis le 24 septembre 2026 (décision du commanditaire) : le
   * King Fahd Palace n'en met que deux à disposition du Forum.
   *
   * Ajouter, renommer ou retirer une salle reste possible en BackOffice : cette
   * liste est un point de départ, pas une contrainte.
   */
  const roomsData = [
    { name: "Salle d'Ouverture", capacity: 400, floor: "Niveau 0" },
    { name: "Salle de Plénière", capacity: 600, floor: "Niveau 0" },
  ] as const;

  const rooms: Record<string, { id: string }> = {};
  for (const room of roomsData) {
    const existante = await prisma.room.findFirst({
      where: { editionId: edition.id, name: room.name },
    });
    rooms[room.name] =
      existante ?? (await prisma.room.create({ data: { ...room, editionId: edition.id } }));
  }

  /*
   * Le seed supprimait ici les salles absentes de sa liste, même créées en
   * BackOffice, dès qu'aucune séance n'y était rattachée. Retiré le 1er octobre
   * 2026 : le seed ne supprime rien de ce qu'il n'a pas créé.
   */

  // ---------------------------------------------------------------------
  // Niveaux de sponsors (docx §12 / brief §5.9)
  // ---------------------------------------------------------------------
  const sponsorLevelsData = [
    { code: "PRINCIPAL", name: "Sponsor principal", sortOrder: 10, logoMaxWidth: 320 },
    { code: "GOLD", name: "Gold", sortOrder: 20, logoMaxWidth: 260 },
    { code: "SILVER", name: "Silver", sortOrder: 30, logoMaxWidth: 220 },
    { code: "BRONZE", name: "Bronze", sortOrder: 40, logoMaxWidth: 180 },
    { code: "INSTITUTIONNEL", name: "Partenaire institutionnel", sortOrder: 50, logoMaxWidth: 200 },
    { code: "TECHNIQUE", name: "Partenaire technique", sortOrder: 60, logoMaxWidth: 200 },
    { code: "MEDIA", name: "Partenaire média", sortOrder: 70, logoMaxWidth: 200 },
  ] as const;

  const sponsorLevels: Record<string, { id: string }> = {};
  for (const level of sponsorLevelsData) {
    sponsorLevels[level.code] = await prisma.sponsorLevel.upsert({
      where: { editionId_code: { editionId: edition.id, code: level.code } },
      update: {},
      create: { ...level, editionId: edition.id },
    });
  }

  // ---------------------------------------------------------------------
  // Contacts pratiques (§29)
  // ---------------------------------------------------------------------
  const contactsPratiques = [
    {
      labelFr: "Inscriptions et accréditations",
      labelEn: "Registration and accreditation",
      name: "Comité d'organisation",
      email: "forum@ansd.sn",
      phone: "+221 33 869 21 39",
      sortOrder: 0,
    },
    {
      labelFr: "Accréditation presse",
      labelEn: "Press accreditation",
      email: "presse@ansd.sn",
      sortOrder: 1,
    },
    {
      labelFr: "Hébergement et logistique",
      labelEn: "Accommodation and logistics",
      email: "logistique@ansd.sn",
      sortOrder: 2,
    },
  ];

  for (const contact of contactsPratiques) {
    const existant = await prisma.practicalContact.findFirst({
      where: { editionId: edition.id, labelFr: contact.labelFr },
    });
    if (!existant) {
      await prisma.practicalContact.create({ data: { ...contact, editionId: edition.id } });
    }
  }

  // ---------------------------------------------------------------------
  // Modèles de notifications — clés du périmètre Lot 1 (PLAN.md §3.8)
  // ---------------------------------------------------------------------
  const notificationTemplatesData = [
    {
      key: "invitation",
      subjectFr: "Vous êtes invité(e) au Forum international sur les données",
      subjectEn: "You are invited to the International Data Forum",
      bodyFr:
        "Bonjour {{prenom}},\n\nVous êtes invité(e) à participer au Forum international sur les données de l'ANSD, du 23 au 25 novembre 2026 à Dakar.\n\nConfirmez votre inscription via votre lien personnalisé (confirmation obligatoire !) : {{lien_inscription}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nYou are invited to the ANSD International Data Forum, 23–25 November 2026 in Dakar.\n\nPlease confirm your registration using your personal link (confirmation required!): {{lien_inscription}}\n\nBest regards,\nThe organising committee",
      variables: ["prenom", "lien_inscription"],
    },
    {
      key: "invitation_reminder",
      subjectFr: "Rappel — Inscription au Forum international sur les données",
      subjectEn: "Reminder — Registration for the International Data Forum",
      bodyFr:
        "Bonjour {{prenom}},\n\nNous n'avons pas encore reçu votre inscription au Forum. Il ne reste que quelques places : {{lien_inscription}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nWe have not yet received your registration for the Forum. Only a few places remain: {{lien_inscription}}\n\nBest regards,\nThe organising committee",
      variables: ["prenom", "lien_inscription"],
    },
    {
      key: "registration_received",
      subjectFr: "Votre inscription a bien été reçue",
      subjectEn: "Your registration has been received",
      bodyFr:
        "Bonjour {{prenom}},\n\nVotre inscription au Forum international sur les données a bien été reçue. Elle doit maintenant être validée par le comité d'organisation.\n\nVotre badge sera disponible dans votre espace personnel dès que votre inscription aura été validée. Vous recevrez alors un e-mail de confirmation, puis un second lorsque votre badge sera prêt.\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nYour registration for the International Data Forum has been received. It must now be validated by the organising committee.\n\nYour badge will be available in your personal space as soon as your registration has been validated. You will then receive a confirmation e-mail, followed by a second one when your badge is ready.\n\nBest regards,\nThe organising committee",
      variables: ["prenom"],
    },
    {
      key: "registration_confirmed",
      subjectFr: "Votre participation au Forum est confirmée",
      subjectEn: "Your participation in the Forum is confirmed",
      // `lien_espace` ouvre directement l'espace (lien signé, 14 jours) et
      // `code6` est un code de secours : plus d'aller-retour par la page
      // « Mon espace » après la confirmation (29 septembre 2026).
      bodyFr:
        "Bonjour {{prenom}},\n\nVotre participation au Forum international sur les données est confirmée.\n\nAfin d'avoir accès au programme mis à jour, à la liste des panélistes et à toutes les informations utiles sur le Forum, accédez directement à votre espace, sans autre démarche : {{lien_espace}}\nCe lien vous est personnel ; il reste valable 14 jours.\n\nCode d'accès de secours, à saisir avec votre adresse e-mail sur la page « Mon espace » : {{code6}}\n{{referent_bloc}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        'Hello {{prenom}},\n\nYour participation in the International Data Forum is confirmed.\n\nTo access the updated programme, the list of panellists and all useful information about the Forum, go straight to your personal space, with no further step: {{lien_espace}}\nThis link is personal and remains valid for 14 days.\n\nBackup access code, to enter with your e-mail address on the "My space" page: {{code6}}\n{{referent_bloc}}\n\nBest regards,\nThe organising committee',
      // `referent_bloc` est un paragraphe entier, composé côté serveur et vide
      // quand le participant n'a pas de délégation : le moteur ne sait pas
      // conditionner, et une phrase à trous aurait été envoyée telle quelle.
      variables: ["prenom", "lien_espace", "code6", "referent_bloc"],
    },
    // Participants importés par fichier (29/09/2026) : inscrits par le comité.
    {
      key: "registration_imported",
      subjectFr: "Votre inscription au Forum international sur les données",
      subjectEn: "Your registration for the International Data Forum",
      bodyFr:
        "Bonjour {{prenom}},\n\nSuite à la confirmation de votre participation, le comité d'organisation vous a inscrit(e) au Forum international sur les données. Vous n'avez aucune démarche d'inscription à faire.\n\nAfin d'avoir accès au programme mis à jour, à la liste des panélistes et à toutes les informations utiles sur le Forum, accédez directement à votre espace : {{lien_espace}}\nCe lien vous est personnel ; il reste valable 14 jours.\n\nCode d'accès de secours, à saisir avec votre adresse e-mail sur la page « Mon espace » : {{code6}}\n\nDans votre espace, vous pourrez vérifier et compléter vos informations, ajouter votre photo et télécharger votre badge. Un e-mail vous préviendra dès que le badge sera prêt.\n{{referent_bloc}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        'Hello {{prenom}},\n\nFollowing the confirmation of your participation, the organising committee has registered you for the International Data Forum. There is no registration step left for you to complete.\n\nTo access the updated programme, the list of panellists and all useful information about the Forum, go straight to your personal space: {{lien_espace}}\nThis link is personal and remains valid for 14 days.\n\nBackup access code, to enter with your e-mail address on the "My space" page: {{code6}}\n\nIn your space, you can check and complete your details, add your photo and download your badge. An e-mail will let you know as soon as the badge is ready.\n{{referent_bloc}}\n\nBest regards,\nThe organising committee',
      variables: ["prenom", "lien_espace", "code6", "referent_bloc"],
    },
    // Formulaire de contact du site : message transmis au comité (29/09/2026).
    {
      key: "contact_message",
      subjectFr: "[Contact site] {{objet}}",
      subjectEn: "[Website contact] {{objet}}",
      bodyFr:
        "Nouveau message reçu par le formulaire de contact du site.\n\nDe : {{nom}} <{{email}}>\nOrganisation : {{organisation}}\nObjet : {{objet}}\n\n{{message}}\n\n—\nRépondez directement à ce message : la réponse part vers l'adresse de l'expéditeur.",
      bodyEn:
        "New message received through the website contact form.\n\nFrom: {{nom}} <{{email}}>\nOrganisation: {{organisation}}\nSubject: {{objet}}\n\n{{message}}\n\n—\nReply directly to this message: the answer goes to the sender's address.",
      variables: ["nom", "email", "organisation", "objet", "message"],
    },
    // Presse : attente puis octroi de l'accréditation (29 septembre 2026).
    {
      key: "accreditation_pending",
      subjectFr: "Votre demande d'accréditation presse est bien reçue",
      subjectEn: "Your press accreditation request has been received",
      bodyFr:
        "Bonjour {{prenom}},\n\nNous avons bien reçu votre demande d'accréditation presse pour le Forum international sur les données.\n\nVotre compte sera activé dès que l'administration du Forum aura accordé votre accréditation. Vous recevrez alors un e-mail avec un accès direct à votre espace, où vous retrouverez votre badge presse.\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nWe have received your press accreditation request for the International Data Forum.\n\nYour account will be activated as soon as the Forum administration has granted your accreditation. You will then receive an e-mail with direct access to your personal space, where your press badge will be available.\n\nBest regards,\nThe organising committee",
      variables: ["prenom"],
    },
    {
      key: "accreditation_granted",
      subjectFr: "Votre accréditation presse est accordée",
      subjectEn: "Your press accreditation has been granted",
      bodyFr:
        "Bonjour {{prenom}},\n\nVotre accréditation presse pour le Forum international sur les données est accordée : votre compte est activé.\n\nAccédez directement à votre espace : {{lien_espace}}\nCe lien vous est personnel ; il reste valable 14 jours.\n\nCode d'accès de secours, à saisir avec votre adresse e-mail sur la page « Mon espace » : {{code6}}\n\nVotre badge presse, qui porte la mention « Accréditation presse », y sera disponible dès sa génération.\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        'Hello {{prenom}},\n\nYour press accreditation for the International Data Forum has been granted: your account is now active.\n\nGo straight to your personal space: {{lien_espace}}\nThis link is personal and remains valid for 14 days.\n\nBackup access code, to enter with your e-mail address on the "My space" page: {{code6}}\n\nYour press badge, marked "Press accreditation", will be available there as soon as it is generated.\n\nBest regards,\nThe organising committee',
      variables: ["prenom", "lien_espace", "code6"],
    },
    // Presse : refus de l'accréditation (12 octobre 2026).
    {
      key: "accreditation_declined",
      subjectFr: "Votre demande d'accréditation presse",
      subjectEn: "Your press accreditation request",
      bodyFr:
        "Bonjour {{prenom}},\n\nNous vous remercions de votre intérêt pour le Forum international sur les données.\n\nAprès examen, nous ne sommes malheureusement pas en mesure de donner une suite favorable à votre demande d'accréditation presse.\n\nPour toute question, vous pouvez écrire au comité d'organisation depuis la rubrique « Nous écrire » du portail.\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        'Hello {{prenom}},\n\nThank you for your interest in the International Data Forum.\n\nAfter review, we regret that we are unable to grant your press accreditation request.\n\nIf you have any questions, you can write to the organising committee through the "Write to us" section of the portal.\n\nBest regards,\nThe organising committee',
      variables: ["prenom"],
    },
    {
      key: "badge_ready",
      subjectFr: "Votre badge est disponible",
      subjectEn: "Your badge is ready",
      bodyFr:
        "Bonjour {{prenom}},\n\nVotre badge pour le Forum international sur les données est prêt. Téléchargez-le : {{lien_badge}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nYour badge for the International Data Forum is ready. Download it here: {{lien_badge}}\n\nBest regards,\nThe organising committee",
      variables: ["prenom", "lien_badge"],
    },
    {
      // Second facteur des comptes BackOffice (PLAN.md §23) : sans ce modèle,
      // plus personne ne peut se connecter à l'administration.
      key: "admin_login_code",
      subjectFr: "Votre code de connexion au BackOffice",
      subjectEn: "Your BackOffice sign-in code",
      bodyFr:
        "Bonjour {{nom}},\n\nVoici votre code de connexion au BackOffice du Forum, valable {{minutes}} minutes :\n\n{{code6}}\n\nVous pouvez aussi valider la connexion depuis ce lien : {{lien_validation}}\n\nSi vous n'êtes pas à l'origine de cette connexion, ignorez ce message et changez votre mot de passe.\n\nLe comité d'organisation",
      bodyEn:
        "Hello {{nom}},\n\nHere is your sign-in code for the Forum BackOffice, valid for {{minutes}} minutes:\n\n{{code6}}\n\nYou can also confirm the sign-in from this link: {{lien_validation}}\n\nIf you did not initiate this sign-in, ignore this message and change your password.\n\nThe organising committee",
      variables: ["nom", "code6", "lien_validation", "minutes"],
    },
    {
      key: "magic_link",
      subjectFr: "Votre lien d'accès à « Mon espace »",
      subjectEn: 'Your access link to "My space"',
      bodyFr:
        "Bonjour,\n\nVoici votre lien d'accès à votre espace participant, valable 30 minutes : {{lien_connexion}}\n\nCode de secours : {{code6}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello,\n\nHere is your access link to your participant space, valid for 30 minutes: {{lien_connexion}}\n\nBackup code: {{code6}}\n\nBest regards,\nThe organising committee",
      variables: ["lien_connexion", "code6"],
    },
    {
      key: "speaker_link",
      subjectFr: "Votre espace intervenant — Forum international sur les données",
      subjectEn: "Your speaker space — International Data Forum",
      bodyFr:
        "Bonjour {{prenom}},\n\nVoici votre lien d'accès à l'espace intervenant, valable 30 minutes : {{lien_connexion}}\n\nVous pourrez y déposer votre photo, votre biographie et votre présentation.\n\nCode de secours : {{code6}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nHere is your access link to the speaker space, valid for 30 minutes: {{lien_connexion}}\n\nYou can upload your photograph, biography and presentation there.\n\nBackup code: {{code6}}\n\nBest regards,\nThe organising committee",
      variables: ["prenom", "lien_connexion", "code6"],
    },
    {
      key: "reminder_j7",
      subjectFr: "Le Forum ouvre dans une semaine",
      subjectEn: "The Forum opens in one week",
      bodyFr:
        "Bonjour {{prenom}},\n\nLe Forum international sur les données ouvre dans une semaine, du 23 au 25 novembre 2026 à l'Hôtel King Fahd Palace, à Dakar.\n\nPensez à télécharger votre badge avant de venir : le badge est obligatoire et vous sera demandé à l'entrée. Téléchargez-le dans votre espace : {{lien_espace}}\n\nÀ très bientôt,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nThe International Data Forum opens in one week, from 23 to 25 November 2026 at the King Fahd Palace Hotel in Dakar.\n\nPlease download your badge before you come: the badge is mandatory and will be checked at the entrance. Download it from your personal space: {{lien_espace}}\n\nSee you soon,\nThe organising committee",
      variables: ["prenom", "lien_espace"],
    },
    {
      key: "reminder_j1",
      subjectFr: "Le Forum, c'est demain",
      subjectEn: "The Forum starts tomorrow",
      bodyFr:
        "Bonjour {{prenom}},\n\nLe Forum international sur les données ouvre demain matin à l'Hôtel King Fahd Palace, à Dakar. L'accueil est ouvert dès 8 h.\n\nPrésentez le QR de votre badge à l'entrée, sur votre téléphone ou imprimé : {{lien_espace}}\n\nBonne journée,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nThe International Data Forum opens tomorrow morning at the King Fahd Palace Hotel in Dakar. The welcome desk opens at 8 a.m.\n\nShow your badge QR code at the entrance, on your phone or printed: {{lien_espace}}\n\nHave a good day,\nThe organising committee",
      variables: ["prenom", "lien_espace"],
    },
    {
      key: "session_promoted",
      subjectFr: "Une place s'est libérée : {{session}}",
      subjectEn: "A seat has opened up: {{session}}",
      bodyFr:
        "Bonjour {{prenom}},\n\nUne place s'est libérée pour la session « {{session}} » et vous étiez le premier sur la liste d'attente : votre inscription est désormais confirmée.\n\nRetrouvez votre programme dans votre espace : {{lien_espace}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nA seat has opened up for the session \u00ab {{session}} \u00bb and you were first on the waiting list: your registration is now confirmed.\n\nFind your programme in your personal space: {{lien_espace}}\n\nBest regards,\nThe organising committee",
      variables: ["prenom", "session", "lien_espace"],
    },
    {
      key: "thank_you",
      subjectFr: "Merci pour votre participation au Forum",
      subjectEn: "Thank you for your participation in the Forum",
      bodyFr:
        "Bonjour {{prenom}},\n\nMerci pour votre participation au Forum international sur les données. Les actes du Forum seront bientôt disponibles sur le portail.\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nThank you for taking part in the International Data Forum. The Forum proceedings will soon be available on the portal.\n\nBest regards,\nThe organising committee",
      variables: ["prenom"],
    },
    /*
     * Annonce d'une newsletter (§34).
     *
     * Une **annonce avec lien**, jamais le texte intégral : les messageries
     * d'entreprise bloquent les images distantes, et Gmail tronque les longs
     * messages en masquant précisément ce qu'on voulait faire lire. Les images
     * et la mise en forme vivent sur le site, où elles s'affichent.
     */
    {
      key: "newsletter_published",
      subjectFr: "{{titre}}",
      subjectEn: "{{titre}}",
      bodyFr:
        "Bonjour {{prenom}},\n\n{{titre}}\n\n{{chapo}}\n\nLire l'information complète, avec les illustrations, et la télécharger en PDF :\n{{lien_newsletter}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\n{{titre}}\n\n{{chapo}}\n\nRead the full text with illustrations, and download it as a PDF:\n{{lien_newsletter}}\n\nBest regards,\nThe organising committee",
      variables: ["prenom", "titre", "chapo", "lien_newsletter"],
    },
    /*
     * Alertes du référent d'une délégation (§28). Destinataire : un membre du
     * comité d'organisation de l'ANSD, d'où le français des deux côtés — la
     * version anglaise existe parce que la colonne l'exige, pas parce qu'elle
     * sert.
     */
    {
      key: "delegation_referent_assigned",
      subjectFr: "Vous accompagnez : {{delegation_nom}}",
      subjectEn: "You are the contact for: {{delegation_nom}}",
      bodyFr:
        "Bonjour {{referent_nom}},\n\nVous êtes désigné(e) référent pour {{delegation_nom}} ({{delegation_pays}}), au Forum international sur les données.\n\nElle compte aujourd'hui {{effectif}} membre(s) :\n{{liste_membres}}\n\nVos coordonnées leur sont communiquées, et vous serez prévenu(e) à chaque nouvelle inscription.\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{referent_nom}},\n\nYou have been designated as the contact for {{delegation_nom}} ({{delegation_pays}}) at the International Data Forum.\n\nIt currently has {{effectif}} member(s):\n{{liste_membres}}\n\nYour details are shared with them, and you will be notified of each new registration.\n\nBest regards,\nThe organising committee",
      variables: ["referent_nom", "delegation_nom", "delegation_pays", "effectif", "liste_membres"],
    },
    {
      key: "delegation_member_added",
      subjectFr: "{{delegation_nom}} : {{membre_nom}} vient de s'inscrire",
      subjectEn: "{{delegation_nom}}: {{membre_nom}} has just registered",
      bodyFr:
        "Bonjour {{referent_nom}},\n\n{{membre_nom}} ({{membre_organisation}}) vient de rejoindre {{delegation_nom}}.\n\nContact : {{membre_email}}\nElle compte désormais {{effectif}} membre(s).\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{referent_nom}},\n\n{{membre_nom}} ({{membre_organisation}}) has joined {{delegation_nom}}.\n\nContact: {{membre_email}}\nThe delegation now has {{effectif}} member(s).\n\nBest regards,\nThe organising committee",
      variables: [
        "referent_nom",
        "delegation_nom",
        "membre_nom",
        "membre_email",
        "membre_organisation",
        "effectif",
      ],
    },
  ] as const;

  for (const tpl of notificationTemplatesData) {
    await prisma.notificationTemplate.upsert({
      where: {
        editionId_key_channel: { editionId: edition.id, key: tpl.key, channel: "EMAIL" },
      },
      update: {},
      create: { ...tpl, channel: "EMAIL", editionId: edition.id },
    });
  }

  // Portugais (30 septembre 2026) : traductions de départ des modèles destinés
  // aux participants, des catégories et du nom du Forum — même source que la
  // migration `portugais_contenus`. Une saisie existante n'est jamais écrasée.
  for (const [key, modele] of Object.entries(MODELES_PT.modeles)) {
    await prisma.notificationTemplate.updateMany({
      where: { editionId: edition.id, key, channel: "EMAIL", bodyPt: null },
      data: { subjectPt: modele.subject, bodyPt: modele.body },
    });
  }
  for (const [code, labelPt] of Object.entries(MODELES_PT.categories)) {
    await prisma.participantCategory.updateMany({
      where: { editionId: edition.id, code, labelPt: null },
      data: { labelPt },
    });
  }
  await prisma.edition.updateMany({
    where: { id: edition.id, titlePt: null },
    data: { titlePt: MODELES_PT.edition.titlePt },
  });

  // ---------------------------------------------------------------------
  // Contenus éditoriaux (brief §5.11) — texte par défaut, éditable en BackOffice
  // ---------------------------------------------------------------------
  const contentBlocksData: Record<string, { fr: string; en: string }> = {
    "home.hero.title": {
      fr: "Des données fiables pour des décisions qui comptent",
      en: "Reliable data for decisions that matter",
    },
    "home.hero.lead": {
      fr: "Trois jours de plénières, de panels et d'ateliers réunissant les instituts nationaux de statistique, les organisations internationales, les chercheurs et les décideurs autour de la production, du partage et de l'usage des données en Afrique.",
      en: "Three days of plenaries, panels and workshops bringing together national statistics institutes, international organisations, researchers and decision-makers around the production, sharing and use of data in Africa.",
    },
    "home.objectives.intro": {
      fr: "Chaque journée du Forum est construite autour d'une question posée aux producteurs et aux utilisateurs de données : comment produire des données de qualité, comment les partager en confiance, et comment décider avec elles.",
      en: "Each day of the Forum is built around a question put to data producers and users: how to produce quality data, how to share it in confidence, and how to decide with it.",
    },
    "about.body": {
      fr: "Le Forum international sur les données est une initiative de l'Agence nationale de la Statistique et de la Démographie (ANSD) du Sénégal. Il réunit, à Dakar, les acteurs africains et internationaux de la statistique publique autour des enjeux de production, de partage et d'usage des données au service des politiques publiques.",
      en: "The International Data Forum is an initiative of Senegal's National Agency for Statistics and Demography (ANSD). It brings together African and international public statistics stakeholders in Dakar around the challenges of producing, sharing and using data for public policy.",
    },
    "practical.venue": {
      fr: "Hôtel King Fahd Palace. Route des Almadies, Dakar",
      en: "King Fahd Palace Hotel. Almadies Road, Dakar",
    },
    "practical.arrival": {
      fr: "Aéroport international Blaise Diagne (AIBD). Navettes prévues pour les délégations sur présentation du badge.",
      en: "Blaise Diagne International Airport (AIBD). Shuttles provided for delegations upon presentation of the badge.",
    },
    "practical.accommodation": {
      fr: "Tarifs négociés à l'Hôtel King Fahd Palace, sur le lieu du Forum, et dans des hôtels partenaires de Dakar. Le code de réservation est envoyé après confirmation de votre inscription.",
      en: "Negotiated rates at the King Fahd Palace Hotel, the Forum venue itself, and at partner hotels in Dakar. The booking code is sent after your registration is confirmed.",
    },
    "practical.visa": {
      fr: "Une lettre d'invitation officielle, générée depuis votre espace participant, facilite les démarches consulaires pour les participants internationaux.",
      en: "An official invitation letter, generated from your participant space, facilitates consular procedures for international participants.",
    },
    "practical.transport": {
      fr: "Navettes entre les hôtels partenaires et le King Fahd Palace, matin et soir. Parking sur place pour les participants.",
      en: "Shuttles between partner hotels and the King Fahd Palace, morning and evening. On-site parking for participants.",
    },
    "practical.contacts": {
      fr: "forum@ansd.sn · +221 33 869 21 39 — Accréditation presse : presse@ansd.sn",
      en: "forum@ansd.sn · +221 33 869 21 39 — Press accreditation: presse@ansd.sn",
    },
    // Mentions légales et politique de confidentialité (loi n° 2008-12).
    // Rédigées ici comme **brouillon explicitement marqué** : ce sont des
    // engagements juridiques, ils doivent être relus et validés par l'ANSD et
    // son délégué à la protection des données avant l'ouverture publique. Le
    // marqueur en tête du texte rend impossible une mise en ligne par oubli.
    "legal.privacy": {
      fr: "[BROUILLON — À VALIDER PAR L'ANSD ET SON DÉLÉGUÉ À LA PROTECTION DES DONNÉES AVANT OUVERTURE PUBLIQUE]\n\nResponsable du traitement\nAgence nationale de la Statistique et de la Démographie (ANSD), Rocade Fann – Bel-Air – Cerf-volant, Dakar, Sénégal. Contact : forum@ansd.sn\n\nCadre légal\nLoi n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel. Le traitement fait l'objet des formalités requises auprès de la Commission de protection des données personnelles (CDP).\n\nDonnées collectées\n— Identité : civilité, prénom, nom, pays et ville de résidence.\n— Coordonnées : adresse e-mail, numéro de téléphone.\n— Situation professionnelle : organisation, fonction, domaine d'activité.\n— Participation : journées retenues, sessions réservées, dates d'arrivée et de départ.\n— Logistique, si vous en faites la demande : besoins d'hébergement ou de transport, régime alimentaire, besoins particuliers d'accessibilité.\n— Photographie, si vous en fournissez une pour votre badge.\n— Données techniques : adresse IP et horodatage des connexions, conservées pour la sécurité du service.\n\nFinalités\nGestion des inscriptions et des accréditations, production et contrôle des badges, organisation logistique, information des participants avant et pendant le Forum, et établissement de statistiques de participation.\n\nBase légale\nVotre consentement, recueilli lors de l'inscription et horodaté, ainsi que l'exécution des mesures nécessaires à l'organisation de l'événement.\n\nDestinataires\nLes données ne sont accessibles qu'au comité d'organisation du Forum et aux prestataires strictement nécessaires (hébergement, envoi d'e-mails), agissant sur instruction de l'ANSD. Elles ne sont ni vendues ni cédées à des tiers.\n\nCe qui est visible publiquement\nLa page de vérification d'un badge n'affiche que le prénom, le nom, l'organisation, le pays, la catégorie et la validité du badge. Ni votre adresse e-mail, ni votre téléphone, ni votre photographie n'y figurent.\n\nDurée de conservation\nLes données d'inscription sont conservées pendant la durée de l'édition, puis archivées pour les besoins de capitalisation et de statistiques. Les données de logistique et de santé (régime alimentaire, besoins d'accessibilité) sont supprimées à l'issue de l'événement.\n\nVos droits\nVous disposez d'un droit d'accès, de rectification, d'opposition et de suppression. L'accès et la rectification s'exercent directement depuis votre espace « Mon espace ». La suppression se demande depuis ce même espace ou à forum@ansd.sn ; il y est répondu sous trente jours. Vous pouvez également saisir la CDP.\n\nCookies\nLe portail dépose uniquement des cookies nécessaires à son fonctionnement : session de connexion, langue choisie et thème d'affichage. Aucun cookie publicitaire ni de mesure d'audience tierce n'est utilisé.",
      en: '[DRAFT — TO BE APPROVED BY ANSD AND ITS DATA PROTECTION OFFICER BEFORE PUBLIC LAUNCH]\n\nData controller\nAgence nationale de la Statistique et de la Démographie (ANSD), Rocade Fann – Bel-Air – Cerf-volant, Dakar, Senegal. Contact: forum@ansd.sn\n\nLegal framework\nSenegalese Law No. 2008-12 of 25 January 2008 on the protection of personal data. The processing is declared to the Commission de protection des données personnelles (CDP).\n\nData collected\n— Identity: title, first and last name, country and city of residence.\n— Contact details: e-mail address, phone number.\n— Professional details: organisation, job title, field of activity.\n— Participation: selected days, booked sessions, arrival and departure dates.\n— Logistics, where you request it: accommodation or transport needs, dietary requirements, accessibility needs.\n— A photograph, if you provide one for your badge.\n— Technical data: IP address and connection timestamps, kept for service security.\n\nPurposes\nManaging registrations and accreditation, producing and checking badges, organising logistics, informing participants before and during the Forum, and compiling attendance statistics.\n\nLegal basis\nYour consent, collected at registration and timestamped, together with the measures necessary to organise the event.\n\nRecipients\nData is accessible only to the Forum organising committee and to the strictly necessary providers (hosting, e-mail delivery), acting on ANSD\'s instructions. It is never sold or transferred to third parties.\n\nWhat is publicly visible\nThe badge verification page shows only first name, last name, organisation, country, category and badge validity. Neither your e-mail address, nor your phone number, nor your photograph appears there.\n\nRetention\nRegistration data is kept for the duration of the edition, then archived for reporting and statistical purposes. Logistics and health-related data (dietary requirements, accessibility needs) is deleted once the event has ended.\n\nYour rights\nYou have the right to access, correct, object to and delete your data. Access and correction are available directly from your "My space" space. Deletion can be requested from that same space or at forum@ansd.sn, and is answered within thirty days. You may also refer the matter to the CDP.\n\nCookies\nThe portal sets only cookies necessary for it to work: login session, chosen language and display theme. No advertising or third-party analytics cookies are used.',
    },
    "legal.terms": {
      fr: "[BROUILLON — À COMPLÉTER PAR L'ANSD : HÉBERGEUR ET DIRECTEUR DE PUBLICATION]\n\nÉditeur\nAgence nationale de la Statistique et de la Démographie (ANSD), Rocade Fann – Bel-Air – Cerf-volant, Dakar, Sénégal. Téléphone : +221 33 869 21 39. Contact : forum@ansd.sn\n\nDirecteur de la publication\nÀ compléter.\n\nHébergeur\nÀ compléter (raison sociale, adresse et téléphone de l'hébergeur retenu).\n\nPropriété intellectuelle\nLes contenus du portail — textes, visuels, documents et supports de sessions — sont la propriété de l'ANSD ou de leurs auteurs respectifs. Leur réutilisation est soumise à autorisation préalable, sauf mention contraire portée sur le document concerné.\n\nConditions d'utilisation\nL'inscription est personnelle. Le badge délivré est nominatif et incessible : son prêt ou sa reproduction entraîne sa révocation immédiate et le refus d'accès au Forum.\n\nDisponibilité\nL'ANSD s'efforce d'assurer la disponibilité du portail sans pouvoir la garantir, notamment lors des opérations de maintenance.\n\nSignalement\nToute erreur ou difficulté d'accès peut être signalée à forum@ansd.sn.",
      en: "[DRAFT — TO BE COMPLETED BY ANSD: HOSTING PROVIDER AND PUBLICATION DIRECTOR]\n\nPublisher\nAgence nationale de la Statistique et de la Démographie (ANSD), Rocade Fann – Bel-Air – Cerf-volant, Dakar, Senegal. Phone: +221 33 869 21 39. Contact: forum@ansd.sn\n\nPublication director\nTo be completed.\n\nHosting provider\nTo be completed (legal name, address and phone number of the selected provider).\n\nIntellectual property\nPortal content — texts, visuals, documents and session materials — belongs to ANSD or to its respective authors. Reuse requires prior authorisation unless stated otherwise on the document concerned.\n\nTerms of use\nRegistration is personal. The badge issued is nominative and non-transferable: lending or copying it results in immediate revocation and refusal of access to the Forum.\n\nAvailability\nANSD endeavours to keep the portal available but cannot guarantee it, in particular during maintenance.\n\nReporting\nAny error or access difficulty can be reported to forum@ansd.sn.",
    },
  };

  for (const [key, value] of Object.entries(contentBlocksData)) {
    await prisma.contentBlock.upsert({
      where: { editionId_key: { editionId: edition.id, key } },
      update: {},
      create: { editionId: edition.id, key, valueFr: value.fr, valueEn: value.en },
    });
  }

  return { edition, roles, categories, rooms, sponsorLevels };
}

type Reference = Awaited<ReturnType<typeof seedReference>>;

/** Données de démonstration (`prisma/donnees-demo.ts`) : base de développement seulement. */
async function seedDemo({ edition, roles, categories, rooms, sponsorLevels }: Reference) {
  // ---------------------------------------------------------------------
  // Super administrateur [DEMO] — identifiants documentés dans README.md
  // ---------------------------------------------------------------------
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe!Forum2026";
  await prisma.user.upsert({
    where: { email: SUPERADMIN_DEMO.email },
    update: {},
    create: {
      email: SUPERADMIN_DEMO.email,
      name: SUPERADMIN_DEMO.nom,
      passwordHash: await argon2.hash(superAdminPassword, { type: argon2.argon2id }),
      roleId: roles.SUPER_ADMIN.id,
      isActive: true,
    },
  });

  // ---------------------------------------------------------------------
  // Intervenants et programme (brief §11, §5.8)
  // ---------------------------------------------------------------------
  const speakers: Record<string, { id: string }> = {};
  for (const [firstName, lastName, jobTitle, organization, country] of INTERVENANTS_DEMO) {
    const cle = `${firstName} ${lastName}`;
    const existant = await prisma.speaker.findFirst({
      where: { editionId: edition.id, firstName, lastName },
    });
    const donnees = {
      firstName,
      lastName,
      jobTitle,
      organization,
      country,
      // Sans adresse, un intervenant ne peut pas recevoir son lien d'accès et
      // l'espace de dépôt reste inaccessible dans le jeu de démonstration.
      email: emailIntervenantDemo(firstName, lastName),
      bioFr: bioIntervenantDemo(firstName, lastName, organization),
      isPublished: true,
    };
    speakers[cle] =
      existant ?? (await prisma.speaker.create({ data: { ...donnees, editionId: edition.id } }));
  }

  let numero = 1;
  for (const jour of JOURS_DEMO) {
    for (const item of PROGRAMME_DEMO[jour]!) {
      const slug = slugSeanceDemo(jour, item.titleFr);
      const donnees = {
        number: numero++,
        type: item.type,
        titleFr: item.titleFr,
        titleEn: item.titleEn,
        descriptionFr: descriptionSeanceDemo(item.titleFr),
        objectives: item.theme
          ? `[DEMO] Objectifs de la session, rattachés au thème « ${item.theme} ».`
          : null,
        theme: item.theme ?? null,
        day: new Date(`${jour}T00:00:00.000Z`),
        startTime: new Date(`${jour}T${item.start}:00.000Z`),
        endTime: new Date(`${jour}T${item.end}:00.000Z`),
        roomId: item.room ? rooms[item.room]!.id : null,
        capacity: item.capacity ?? null,
        registrationOpen: item.registrationOpen ?? false,
        registrationDeadline: item.registrationOpen ? new Date("2026-11-20T23:59:59.000Z") : null,
        waitlistEnabled: true,
        isPublished: true,
      };

      const session = await prisma.session.upsert({
        where: { editionId_slug: { editionId: edition.id, slug } },
        update: {},
        create: { ...donnees, slug, editionId: edition.id },
      });

      for (const [index, [nom, role]] of (item.speakers ?? []).entries()) {
        await prisma.sessionSpeaker.upsert({
          where: {
            sessionId_speakerId: { sessionId: session.id, speakerId: speakers[nom]!.id },
          },
          update: {},
          create: {
            sessionId: session.id,
            speakerId: speakers[nom]!.id,
            role,
            sortOrder: index,
            confirmationStatus: "CONFIRME",
          },
        });
      }
    }
  }

  // ---------------------------------------------------------------------
  // Hébergement (§29)
  // ---------------------------------------------------------------------
  for (const { rates, ...hotel } of HOTELS_DEMO) {
    const existant = await prisma.hotel.findFirst({
      where: { editionId: edition.id, name: hotel.name },
    });
    // Hôtel déjà en base : ni la fiche ni ses tarifs ne sont réécrits.
    if (existant) continue;
    const enregistre = await prisma.hotel.create({ data: { ...hotel, editionId: edition.id } });

    // Les tarifs sont réécrits en bloc : ils n'ont pas de clé naturelle, et
    // rejouer le seed ne doit pas les empiler.
    await prisma.hotelRate.deleteMany({ where: { hotelId: enregistre.id } });
    await prisma.hotelRate.createMany({
      data: rates.map((rate, index) => ({
        hotelId: enregistre.id,
        roomType: rate.roomType,
        price: rate.price,
        currency: "XOF",
        conditions: rate.conditions,
        sortOrder: index,
      })),
    });
  }

  // ---------------------------------------------------------------------
  // Participants et délégations (brief §11)
  // ---------------------------------------------------------------------
  const delegations = {
    MALI: await upsertDelegation(edition.id, DELEGATIONS_DEMO.MALI),
    COTE_IVOIRE: await upsertDelegation(edition.id, DELEGATIONS_DEMO.COTE_IVOIRE),
  };

  for (const demo of PARTICIPANTS_DEMO) {
    const existing = await prisma.participant.findUnique({
      where: { editionId_email: { editionId: edition.id, email: demo.email } },
    });
    if (existing) continue;

    const category = categories[demo.categoryCode];
    const participant = await createParticipant({
      editionId: edition.id,
      editionCode: edition.code,
      source: demo.source,
      actor: { type: "SYSTEM" },
      input: {
        firstName: demo.firstName,
        lastName: demo.lastName,
        email: demo.email,
        country: demo.country,
        organization: demo.organization,
        jobTitle: demo.jobTitle,
        categoryId: category.id,
        delegationId: demo.delegation ? delegations[demo.delegation].id : undefined,
        locale: "fr",
        attendsOpening: true,
        attendsInaugural: true,
        attendsClosing: true,
        attendsAwards: false,
        needsAccommodation: demo.source === "ONLINE" && demo.country !== "Sénégal",
        needsTransport: false,
        notes: NOTE_PARTICIPANT_DEMO,
      },
    });

    const actor = { type: "SYSTEM" as const };
    if (demo.after === "confirm" && participant.status === "REGISTERED") {
      await confirmParticipant(participant.id, actor);
    } else if (demo.after === "decline" && participant.status === "REGISTERED") {
      await declineParticipant(participant.id, actor);
    } else if (demo.after === "cancel") {
      if (participant.status === "REGISTERED") await confirmParticipant(participant.id, actor);
      await cancelParticipant(participant.id, actor);
    }
  }

  // ---------------------------------------------------------------------
  // Invitations
  // ---------------------------------------------------------------------
  // Le modèle `Invitation` n'a pas d'horodatage de clic (seulement le statut) :
  // seules les dates d'envoi et d'ouverture sont posées ici.
  const STAGE_DATES: Record<string, { sent: boolean; opened: boolean }> = {
    PENDING: { sent: false, opened: false },
    SENT: { sent: true, opened: false },
    OPENED: { sent: true, opened: true },
    CLICKED: { sent: true, opened: true },
    REGISTERED: { sent: true, opened: true },
  };

  for (const seed of INVITATIONS_DEMO) {
    const already = await prisma.invitation.findFirst({
      where: { editionId: edition.id, email: seed.email },
    });
    if (already) continue;

    const marks = STAGE_DATES[seed.stage]!;
    const sentAt = marks.sent ? new Date(Date.now() - 12 * 24 * 3600 * 1000) : null;

    const invitation = await prisma.invitation.create({
      data: {
        editionId: edition.id,
        categoryId: categories[seed.categoryCode].id,
        firstName: seed.firstName,
        lastName: seed.lastName,
        email: seed.email,
        country: seed.country,
        organization: seed.organization,
        token: generateInvitationToken(),
        status: seed.stage,
        sentAt,
        openedAt: marks.opened ? new Date(Date.now() - 11 * 24 * 3600 * 1000) : null,
        respondedAt:
          seed.stage === "REGISTERED" ? new Date(Date.now() - 9 * 24 * 3600 * 1000) : null,
      },
    });

    if (seed.linkTo) {
      const participant = await prisma.participant.findUnique({
        where: { editionId_email: { editionId: edition.id, email: seed.linkTo } },
        select: { id: true, invitationId: true },
      });
      if (participant && !participant.invitationId) {
        await prisma.participant.update({
          where: { id: participant.id },
          data: { invitation: { connect: { id: invitation.id } } },
        });
      }
    }
  }

  // ---------------------------------------------------------------------
  // Partenaires
  // ---------------------------------------------------------------------
  for (const sponsor of PARTENAIRES_DEMO) {
    const existing = await prisma.sponsor.findFirst({
      where: { editionId: edition.id, name: sponsor.name },
    });
    if (existing) continue;
    await prisma.sponsor.create({
      data: {
        editionId: edition.id,
        name: sponsor.name,
        levelId: sponsorLevels[sponsor.levelCode].id,
        isPublished: true,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Actualités
  // ---------------------------------------------------------------------
  for (const post of ACTUALITES_DEMO) {
    const existing = await prisma.post.findUnique({
      where: { editionId_slug: { editionId: edition.id, slug: post.slug } },
    });
    if (existing) continue;
    const publishedAt = new Date(Date.now() - post.daysAgo * 86_400_000);
    await prisma.post.create({
      data: {
        editionId: edition.id,
        slug: post.slug,
        titleFr: post.titleFr,
        titleEn: post.titleEn,
        bodyFr: post.bodyFr,
        bodyEn: post.bodyEn,
        isPublished: true,
        publishedAt,
      },
    });
  }

  console.log("Données de démonstration ajoutées.");
  console.log(`Compte de démonstration : ${SUPERADMIN_DEMO.email} / ${superAdminPassword}`);
}

async function upsertDelegation(
  editionId: string,
  data: { name: string; country: string; institution: string },
) {
  const existing = await prisma.delegation.findFirst({ where: { editionId, name: data.name } });
  if (existing) return existing;
  return prisma.delegation.create({ data: { ...data, editionId } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // `createParticipant`/`confirmParticipant` mettent des jobs en file (Redis via
    // BullMQ) : sans fermeture explicite, un script court-lived comme celui-ci ne
    // se termine jamais (connexion Redis gardée ouverte).
    await jobQueue.close();
  });
