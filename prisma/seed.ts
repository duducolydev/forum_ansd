/**
 * Seed de référence (brief §11) — partie structurelle : édition, catégories, zones,
 * niveaux sponsors, rôles, 1 super admin, modèles de notifications de base.
 *
 * Le volume de contenu de démonstration (3 jours × 10 sessions, 25 intervenants,
 * 300 participants [DEMO]) est ajouté au fil de l'implémentation des modules
 * correspondants (cf. PLAN.md §2, tâche 0.2), une fois ces modules disponibles
 * pour les faire naviguer dans un état cohérent plutôt que des lignes orphelines.
 *
 * Idempotent : peut être exécuté plusieurs fois (`pnpm db:seed`) sans dupliquer les données.
 */
import "dotenv/config";
import argon2 from "argon2";
import { prisma } from "../src/lib/db";
import { DEFAULT_ROLE_PERMISSIONS } from "../src/lib/permissions";

async function main() {
  // ---------------------------------------------------------------------
  // Édition
  // ---------------------------------------------------------------------
  const edition = await prisma.edition.upsert({
    where: { code: "FID-2026" },
    update: {},
    create: {
      code: "FID-2026",
      title: "Forum international sur les données",
      theme: "Des données fiables pour des décisions qui comptent",
      startDate: new Date("2026-11-23T00:00:00Z"),
      endDate: new Date("2026-11-25T23:59:59Z"),
      venue: "CICAD, Diamniadio",
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
      update: { permissions },
      create: { name, permissions },
    });
  }

  // ---------------------------------------------------------------------
  // Super administrateur [DEMO] — identifiants documentés dans README.md
  // ---------------------------------------------------------------------
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe!Forum2026";
  await prisma.user.upsert({
    where: { email: "superadmin@ansd.sn" },
    update: {},
    create: {
      email: "superadmin@ansd.sn",
      name: "Super Administrateur [DEMO]",
      passwordHash: await argon2.hash(superAdminPassword, { type: argon2.argon2id }),
      roleId: roles.SUPER_ADMIN.id,
      isActive: true,
    },
  });

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
      sortOrder: 10,
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
      labelFr: "Prestataire",
      labelEn: "Service provider",
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
      sortOrder: 110,
    },
  ] as const;

  const categories: Record<string, { id: string }> = {};
  for (const cat of categoriesData) {
    categories[cat.code] = await prisma.participantCategory.upsert({
      where: { editionId_code: { editionId: edition.id, code: cat.code } },
      update: cat,
      create: { ...cat, editionId: edition.id },
    });
  }

  // ---------------------------------------------------------------------
  // Zones d'accès (docx §15)
  // ---------------------------------------------------------------------
  const zonesData = [
    { code: "ENTREE", name: "Entrée principale" },
    { code: "PLENIERE", name: "Salle plénière" },
    { code: "PANEL_1", name: "Salle Panel 1" },
    { code: "PANEL_2", name: "Salle Panel 2" },
    { code: "VIP", name: "Espace VIP" },
    { code: "SPONSORS", name: "Espace sponsors" },
    { code: "RESTAURATION", name: "Restauration" },
  ] as const;

  const zones: Record<string, { id: string }> = {};
  for (const zone of zonesData) {
    zones[zone.code] = await prisma.zone.upsert({
      where: { editionId_code: { editionId: edition.id, code: zone.code } },
      update: zone,
      create: { ...zone, editionId: edition.id },
    });
  }

  // Matrice catégorie × zone — valeurs par défaut, ajustables en BackOffice (brief §2.6)
  const allZones = Object.keys(zones);
  const categoryZoneMatrix: Record<string, string[]> = {
    AUTORITE_VIP: allZones,
    PARTICIPANT_NATIONAL: ["ENTREE", "PLENIERE", "PANEL_1", "PANEL_2", "RESTAURATION"],
    PARTICIPANT_INTERNATIONAL: ["ENTREE", "PLENIERE", "PANEL_1", "PANEL_2", "RESTAURATION"],
    INS: ["ENTREE", "PLENIERE", "PANEL_1", "PANEL_2", "RESTAURATION"],
    ORG_INTERNATIONALE: ["ENTREE", "PLENIERE", "PANEL_1", "PANEL_2", "RESTAURATION"],
    PTF: ["ENTREE", "PLENIERE", "PANEL_1", "PANEL_2", "RESTAURATION"],
    SPONSOR: ["ENTREE", "PLENIERE", "SPONSORS", "RESTAURATION"],
    MEDIA: ["ENTREE", "PLENIERE", "PANEL_1", "PANEL_2", "RESTAURATION"],
    PERSONNEL_ANSD: allZones,
    PRESTATAIRE: ["ENTREE", "RESTAURATION"],
    INVITE_SPECIAL: ["ENTREE", "PLENIERE", "PANEL_1", "PANEL_2", "VIP", "RESTAURATION"],
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

  for (const level of sponsorLevelsData) {
    await prisma.sponsorLevel.upsert({
      where: { editionId_code: { editionId: edition.id, code: level.code } },
      update: level,
      create: { ...level, editionId: edition.id },
    });
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
        "Bonjour {{prenom}},\n\nVous êtes invité(e) à participer au Forum international sur les données de l'ANSD, du 23 au 25 novembre 2026 à Dakar.\n\nInscrivez-vous via votre lien personnalisé : {{lien_inscription}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nYou are invited to the ANSD International Data Forum, 23–25 November 2026 in Dakar.\n\nPlease register using your personal link: {{lien_inscription}}\n\nBest regards,\nThe organising committee",
      variables: ["prenom", "lien_inscription"],
    },
    {
      key: "invitation_reminder",
      subjectFr: "Rappel — Inscription au Forum international sur les données",
      subjectEn: "Reminder — Registration for the International Data Forum",
      bodyFr:
        "Bonjour {{prenom}},\n\nNous n'avons pas encore reçu votre inscription au Forum. Il reste des places : {{lien_inscription}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nWe have not yet received your registration for the Forum. Places remain available: {{lien_inscription}}\n\nBest regards,\nThe organising committee",
      variables: ["prenom", "lien_inscription"],
    },
    {
      key: "registration_received",
      subjectFr: "Votre inscription a bien été reçue",
      subjectEn: "Your registration has been received",
      bodyFr:
        "Bonjour {{prenom}},\n\nVotre inscription au Forum a bien été reçue et est en attente de validation par le comité d'organisation.\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nYour registration for the Forum has been received and is pending validation by the organising committee.\n\nBest regards,\nThe organising committee",
      variables: ["prenom"],
    },
    {
      key: "registration_confirmed",
      subjectFr: "Votre participation au Forum est confirmée",
      subjectEn: "Your participation in the Forum is confirmed",
      bodyFr:
        "Bonjour {{prenom}},\n\nVotre participation au Forum international sur les données est confirmée. Retrouvez vos informations dans votre espace : {{lien_espace}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nYour participation in the International Data Forum is confirmed. Find your details in your personal space: {{lien_espace}}\n\nBest regards,\nThe organising committee",
      variables: ["prenom", "lien_espace"],
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
      key: "magic_link",
      subjectFr: "Votre lien d'accès à « Mes inscriptions »",
      subjectEn: 'Your access link to "My registrations"',
      bodyFr:
        "Bonjour,\n\nVoici votre lien d'accès à votre espace participant, valable 30 minutes : {{lien_connexion}}\n\nCode de secours : {{code6}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello,\n\nHere is your access link to your participant space, valid for 30 minutes: {{lien_connexion}}\n\nBackup code: {{code6}}\n\nBest regards,\nThe organising committee",
      variables: ["lien_connexion", "code6"],
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
  ] as const;

  for (const tpl of notificationTemplatesData) {
    await prisma.notificationTemplate.upsert({
      where: {
        editionId_key_channel: { editionId: edition.id, key: tpl.key, channel: "EMAIL" },
      },
      update: tpl,
      create: { ...tpl, channel: "EMAIL", editionId: edition.id },
    });
  }

  console.log(`Seed terminé pour l'édition ${edition.code}.`);
  console.log(`Compte de démonstration : superadmin@ansd.sn / ${superAdminPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
