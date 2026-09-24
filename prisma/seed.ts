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
import { jobQueue } from "../src/lib/queue";
import { DEFAULT_ROLE_PERMISSIONS } from "../src/lib/permissions";
import {
  cancelParticipant,
  confirmParticipant,
  createParticipant,
  declineParticipant,
} from "../src/modules/participants/service";
import { generateInvitationToken } from "../src/modules/invitations/service";

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
      alertOnScan: true,
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
      alertOnScan: true,
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
      update: zone,
      create: { ...zone, editionId: edition.id },
    });
  }

  /*
   * Zones d'une liste précédente : retirées, mais **seulement** si aucun point
   * de contrôle ne les vise. Les autorisations par catégorie et les
   * dérogations individuelles disparaissent avec elles, par cascade — ce sont
   * des droits sur une zone qui n'existe plus.
   *
   * Un point de contrôle, lui, a été posé physiquement quelque part : le seed
   * ne le défait pas, il le signale.
   */
  const zonesObsoletes = await prisma.zone.findMany({
    where: { editionId: edition.id, code: { notIn: zonesData.map((z) => z.code) } },
    include: { _count: { select: { checkpoints: true } } },
  });
  for (const zone of zonesObsoletes) {
    if (zone._count.checkpoints > 0) {
      console.warn(
        `[seed] zone « ${zone.name} » conservée : ${zone._count.checkpoints} point(s) de contrôle la visent.`,
      );
      continue;
    }
    await prisma.zone.delete({ where: { id: zone.id } });
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
  // Salles, intervenants et programme [DEMO] (brief §11, §5.8)
  // ---------------------------------------------------------------------
  /*
   * Deux salles depuis le 24 septembre 2026 (décision du commanditaire) : le
   * King Fahd Palace n'en met que deux à disposition du Forum. Le programme de
   * démonstration ci-dessous a été redistribué sur ces deux salles, sans
   * qu'aucune séance n'en occupe une déjà prise — vérifié séance par séance.
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
    rooms[room.name] = existante
      ? await prisma.room.update({ where: { id: existante.id }, data: room })
      : await prisma.room.create({ data: { ...room, editionId: edition.id } });
  }

  const speakersData = [
    ["Oulimata", "Sarr", "Ministre", "Ministère de l'Économie et du Plan", "Sénégal"],
    ["Oumar", "Ba", "Directeur général", "ANSD", "Sénégal"],
    ["Ibrahima", "Koné", "Directeur général", "INSTAT Mali", "Mali"],
    ["Mariam", "Diallo", "Cheffe de service Recensement", "ANStat", "Côte d'Ivoire"],
    ["Kwame", "Osei", "Deputy Government Statistician", "Ghana Statistical Service", "Ghana"],
    ["Julie", "Lambert", "Conseillère régionale", "UNFPA", "France"],
    ["Paul", "Tchoua", "Directeur général", "AFRISTAT", "Mali"],
    ["Aminata", "Sow", "Directrice des statistiques démographiques", "ANSD", "Sénégal"],
  ] as const;

  const speakers: Record<string, { id: string }> = {};
  for (const [firstName, lastName, jobTitle, organization, country] of speakersData) {
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
      email: `demo.speaker.${firstName}.${lastName}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9.]/g, "")
        .concat("@example.test"),
      bioFr: `[DEMO] ${firstName} ${lastName} intervient au Forum au titre de ses fonctions à ${organization}.`,
      isPublished: true,
    };
    speakers[cle] = existant
      ? await prisma.speaker.update({ where: { id: existant.id }, data: donnees })
      : await prisma.speaker.create({ data: { ...donnees, editionId: edition.id } });
  }

  // Trois journées, dix sessions par jour (brief §11). Les moments communs
  // (ouverture, pauses, déjeuner) n'ont pas de salle : ils barrent la grille.
  const JOURS = ["2026-11-23", "2026-11-24", "2026-11-25"] as const;

  type SessionSeed = {
    type:
      | "OPENING"
      | "PLENARY"
      | "PANEL"
      | "INAUGURAL"
      | "AWARDS"
      | "BREAK"
      | "LUNCH"
      | "CLOSING"
      | "SIDE_EVENT";
    titleFr: string;
    titleEn: string;
    start: string;
    end: string;
    room?: string;
    theme?: string;
    capacity?: number;
    registrationOpen?: boolean;
    speakers?: [string, "MODERATOR" | "PANELIST" | "KEYNOTE"][];
  };

  const programme: Record<string, SessionSeed[]> = {
    "2026-11-23": [
      {
        type: "OPENING",
        titleFr: "Cérémonie d'ouverture",
        titleEn: "Opening ceremony",
        start: "09:00",
        end: "10:00",
        speakers: [
          ["Oulimata Sarr", "KEYNOTE"],
          ["Oumar Ba", "MODERATOR"],
        ],
      },
      {
        type: "INAUGURAL",
        titleFr: "Conférence inaugurale : les données au service des politiques publiques",
        titleEn: "Inaugural lecture: data for public policy",
        start: "10:00",
        end: "11:00",
        room: "Salle de Plénière",
        theme: "Gouvernance des données",
        speakers: [["Paul Tchoua", "KEYNOTE"]],
      },
      {
        type: "BREAK",
        titleFr: "Pause-café",
        titleEn: "Coffee break",
        start: "11:00",
        end: "11:30",
      },
      {
        type: "PANEL",
        titleFr: "Panel 1 — Recensements et registres administratifs",
        titleEn: "Panel 1 — Censuses and administrative registers",
        start: "11:30",
        end: "13:00",
        room: "Salle de Plénière",
        theme: "Sources de données",
        capacity: 150,
        registrationOpen: true,
        speakers: [
          ["Ibrahima Koné", "MODERATOR"],
          ["Mariam Diallo", "PANELIST"],
          ["Kwame Osei", "PANELIST"],
        ],
      },
      {
        type: "PANEL",
        titleFr: "Panel 2 — Données climatiques et résilience",
        titleEn: "Panel 2 — Climate data and resilience",
        start: "11:30",
        end: "13:00",
        room: "Salle d'Ouverture",
        theme: "Données et climat",
        capacity: 120,
        registrationOpen: true,
        speakers: [
          ["Julie Lambert", "MODERATOR"],
          ["Aminata Sow", "PANELIST"],
        ],
      },
      { type: "LUNCH", titleFr: "Déjeuner", titleEn: "Lunch", start: "13:00", end: "14:30" },
      {
        type: "PANEL",
        titleFr: "Panel 3 — Qualité et diffusion des statistiques",
        titleEn: "Panel 3 — Statistical quality and dissemination",
        start: "14:30",
        end: "16:00",
        room: "Salle de Plénière",
        theme: "Qualité des données",
        capacity: 150,
        registrationOpen: true,
        speakers: [
          ["Kwame Osei", "MODERATOR"],
          ["Oumar Ba", "PANELIST"],
        ],
      },
      {
        type: "SIDE_EVENT",
        titleFr: "Atelier — Anonymisation des microdonnées",
        titleEn: "Workshop — Microdata anonymisation",
        start: "14:30",
        end: "16:00",
        room: "Salle d'Ouverture",
        theme: "Protection des données",
        capacity: 60,
        registrationOpen: true,
        speakers: [["Aminata Sow", "KEYNOTE"]],
      },
      {
        type: "BREAK",
        titleFr: "Pause-café",
        titleEn: "Coffee break",
        start: "16:00",
        end: "16:30",
      },
      {
        type: "PLENARY",
        titleFr: "Restitution de la première journée",
        titleEn: "Day one wrap-up",
        start: "16:30",
        end: "17:30",
        room: "Salle de Plénière",
        speakers: [["Oumar Ba", "MODERATOR"]],
      },
    ],
    "2026-11-24": [
      {
        type: "PLENARY",
        titleFr: "Plénière — Systèmes statistiques nationaux",
        titleEn: "Plenary — National statistical systems",
        start: "09:00",
        end: "10:30",
        room: "Salle de Plénière",
        theme: "Gouvernance des données",
        speakers: [
          ["Paul Tchoua", "MODERATOR"],
          ["Ibrahima Koné", "PANELIST"],
        ],
      },
      {
        type: "BREAK",
        titleFr: "Pause-café",
        titleEn: "Coffee break",
        start: "10:30",
        end: "11:00",
      },
      {
        type: "PANEL",
        titleFr: "Panel 4 — Données démographiques et projections",
        titleEn: "Panel 4 — Demographic data and projections",
        start: "11:00",
        end: "12:30",
        room: "Salle de Plénière",
        theme: "Sources de données",
        capacity: 150,
        registrationOpen: true,
        speakers: [
          ["Aminata Sow", "MODERATOR"],
          ["Julie Lambert", "PANELIST"],
        ],
      },
      {
        type: "PANEL",
        titleFr: "Panel 5 — Intelligence artificielle et statistique publique",
        titleEn: "Panel 5 — AI and official statistics",
        start: "11:00",
        end: "12:30",
        room: "Salle d'Ouverture",
        theme: "Innovation",
        capacity: 120,
        registrationOpen: true,
        speakers: [
          ["Kwame Osei", "MODERATOR"],
          ["Mariam Diallo", "PANELIST"],
        ],
      },
      { type: "LUNCH", titleFr: "Déjeuner", titleEn: "Lunch", start: "12:30", end: "14:00" },
      {
        type: "PANEL",
        titleFr: "Panel 6 — Financement des systèmes statistiques",
        titleEn: "Panel 6 — Funding statistical systems",
        start: "14:00",
        end: "15:30",
        room: "Salle de Plénière",
        theme: "Gouvernance des données",
        capacity: 150,
        registrationOpen: true,
        speakers: [
          ["Julie Lambert", "MODERATOR"],
          ["Paul Tchoua", "PANELIST"],
        ],
      },
      {
        type: "SIDE_EVENT",
        titleFr: "Atelier — Interopérabilité des registres",
        titleEn: "Workshop — Register interoperability",
        start: "14:00",
        end: "15:30",
        room: "Salle d'Ouverture",
        theme: "Innovation",
        capacity: 60,
        registrationOpen: true,
        speakers: [["Mariam Diallo", "KEYNOTE"]],
      },
      {
        type: "BREAK",
        titleFr: "Pause-café",
        titleEn: "Coffee break",
        start: "15:30",
        end: "16:00",
      },
      {
        type: "PANEL",
        titleFr: "Panel 7 — Données ouvertes et redevabilité",
        titleEn: "Panel 7 — Open data and accountability",
        start: "16:00",
        end: "17:30",
        room: "Salle d'Ouverture",
        theme: "Qualité des données",
        capacity: 120,
        registrationOpen: true,
        speakers: [["Ibrahima Koné", "MODERATOR"]],
      },
      {
        type: "PLENARY",
        titleFr: "Restitution de la deuxième journée",
        titleEn: "Day two wrap-up",
        start: "17:30",
        end: "18:00",
        room: "Salle de Plénière",
        speakers: [["Oumar Ba", "MODERATOR"]],
      },
    ],
    "2026-11-25": [
      {
        type: "PLENARY",
        titleFr: "Plénière — Perspectives régionales",
        titleEn: "Plenary — Regional outlook",
        start: "09:00",
        end: "10:30",
        room: "Salle de Plénière",
        theme: "Gouvernance des données",
        speakers: [
          ["Paul Tchoua", "MODERATOR"],
          ["Kwame Osei", "PANELIST"],
        ],
      },
      {
        type: "BREAK",
        titleFr: "Pause-café",
        titleEn: "Coffee break",
        start: "10:30",
        end: "11:00",
      },
      {
        type: "PANEL",
        titleFr: "Panel 8 — Statistiques sectorielles : santé et éducation",
        titleEn: "Panel 8 — Sector statistics: health and education",
        start: "11:00",
        end: "12:30",
        room: "Salle de Plénière",
        theme: "Sources de données",
        capacity: 150,
        registrationOpen: true,
        speakers: [
          ["Julie Lambert", "MODERATOR"],
          ["Aminata Sow", "PANELIST"],
        ],
      },
      {
        type: "PANEL",
        titleFr: "Panel 9 — Renforcement des capacités",
        titleEn: "Panel 9 — Capacity building",
        start: "11:00",
        end: "12:30",
        room: "Salle d'Ouverture",
        theme: "Innovation",
        capacity: 120,
        registrationOpen: true,
        speakers: [["Mariam Diallo", "MODERATOR"]],
      },
      { type: "LUNCH", titleFr: "Déjeuner", titleEn: "Lunch", start: "12:30", end: "14:00" },
      {
        type: "SIDE_EVENT",
        titleFr: "Atelier — Cartographie et données géospatiales",
        titleEn: "Workshop — Mapping and geospatial data",
        start: "14:00",
        end: "15:00",
        room: "Salle d'Ouverture",
        theme: "Innovation",
        capacity: 60,
        registrationOpen: true,
        speakers: [["Kwame Osei", "KEYNOTE"]],
      },
      {
        type: "PLENARY",
        titleFr: "Synthèse des travaux et recommandations",
        titleEn: "Synthesis and recommendations",
        start: "15:00",
        end: "16:00",
        room: "Salle de Plénière",
        speakers: [
          ["Oumar Ba", "MODERATOR"],
          ["Ibrahima Koné", "PANELIST"],
        ],
      },
      {
        type: "AWARDS",
        titleFr: "Remise des prix de la statistique",
        titleEn: "Statistics awards",
        start: "16:00",
        end: "16:45",
        room: "Salle de Plénière",
        speakers: [["Oulimata Sarr", "KEYNOTE"]],
      },
      {
        type: "CLOSING",
        titleFr: "Cérémonie de clôture",
        titleEn: "Closing ceremony",
        start: "16:45",
        end: "17:30",
        speakers: [
          ["Oulimata Sarr", "KEYNOTE"],
          ["Oumar Ba", "MODERATOR"],
        ],
      },
      {
        type: "SIDE_EVENT",
        titleFr: "Visite du centre de données de l'ANSD",
        titleEn: "Visit to the ANSD data centre",
        start: "17:30",
        end: "18:30",
        room: "Salle d'Ouverture",
        theme: "Innovation",
        capacity: 40,
        registrationOpen: true,
      },
    ],
  };

  function slugDemo(jour: string, titre: string): string {
    const base = titre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90);
    return `${base}-${jour.slice(5).replace("-", "")}`;
  }

  let numero = 1;
  for (const jour of JOURS) {
    for (const item of programme[jour]!) {
      const slug = slugDemo(jour, item.titleFr);
      const donnees = {
        number: numero++,
        type: item.type,
        titleFr: item.titleFr,
        titleEn: item.titleEn,
        descriptionFr: `[DEMO] ${item.titleFr}. Description à remplacer par le comité scientifique.`,
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
        update: donnees,
        create: { ...donnees, slug, editionId: edition.id },
      });

      for (const [index, [nom, role]] of (item.speakers ?? []).entries()) {
        await prisma.sessionSpeaker.upsert({
          where: {
            sessionId_speakerId: { sessionId: session.id, speakerId: speakers[nom]!.id },
          },
          update: { role, sortOrder: index, confirmationStatus: "CONFIRME" },
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

  /*
   * Salles d'une liste précédente : retirées, mais **seulement** si aucune
   * séance ne s'y tient.
   *
   * Ce nettoyage vient **après** le programme, et non juste après la création
   * des salles : à cet endroit-là, les séances de démonstration pointaient
   * encore sur les anciennes salles, qui étaient donc toutes conservées. Le
   * seed converge ainsi vers la liste de référence sans jamais détruire ce
   * qu'il n'a pas créé — une salle ajoutée en BackOffice et utilisée par une
   * vraie séance reste en place, et le cas est signalé plutôt que tranché en
   * silence.
   */
  const sallesObsoletes = await prisma.room.findMany({
    where: { editionId: edition.id, name: { notIn: roomsData.map((r) => r.name) } },
    include: { _count: { select: { sessions: true } } },
  });
  for (const salle of sallesObsoletes) {
    if (salle._count.sessions > 0) {
      console.warn(
        `[seed] salle « ${salle.name} » conservée : ${salle._count.sessions} séance(s) s'y tiennent.`,
      );
      continue;
    }
    await prisma.room.delete({ where: { id: salle.id } });
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

  const sponsorLevels: Record<string, { id: string }> = {};
  for (const level of sponsorLevelsData) {
    sponsorLevels[level.code] = await prisma.sponsorLevel.upsert({
      where: { editionId_code: { editionId: edition.id, code: level.code } },
      update: level,
      create: { ...level, editionId: edition.id },
    });
  }

  // ---------------------------------------------------------------------
  // Hébergement et contacts pratiques [DEMO] (§29)
  //
  // Deux hôtels et trois contacts : de quoi exercer la page de détail, ses
  // tableaux de tarifs et le tri par distance, sans prétendre à un état réel
  // des accords — ils portent la mention [DEMO], comme les participants.
  // ---------------------------------------------------------------------
  const hotelsData = [
    {
      name: "Hôtel King Fahd Palace [DEMO]",
      category: "5 étoiles",
      address: "Route des Almadies, Dakar",
      district: "Almadies",
      distanceKm: 0,
      phone: "+221 33 869 69 69",
      email: "reservation@kingfahdpalace.demo",
      website: "https://example.test/king-fahd-palace",
      descriptionFr:
        "Sur le lieu même du Forum : aucun trajet, et les salles de session sont au rez-de-chaussée.",
      descriptionEn:
        "At the Forum venue itself: no commute, and the session rooms are on the ground floor.",
      amenities: ["Wifi", "Petit-déjeuner", "Piscine", "Salle de sport", "Parking"],
      bookingCode: "FID2026-KFP",
      isPublished: true,
      sortOrder: 0,
      rates: [
        { roomType: "Chambre simple", price: 85000, conditions: "Petit-déjeuner inclus" },
        { roomType: "Chambre double", price: 110000, conditions: "Petit-déjeuner inclus" },
        { roomType: "Suite", price: null, conditions: "Sur demande, minimum deux nuits" },
      ],
    },
    {
      name: "Résidence des Almadies [DEMO]",
      category: "Appart-hôtel",
      address: "Rue des Ambassades, Dakar",
      district: "Almadies",
      distanceKm: 2.4,
      phone: "+221 33 820 11 11",
      website: "https://example.test/residence-almadies",
      descriptionFr: "Studios équipés, navette matin et soir vers le King Fahd Palace.",
      descriptionEn:
        "Serviced studios, with a morning and evening shuttle to the King Fahd Palace.",
      amenities: ["Wifi", "Navette", "Cuisine équipée"],
      bookingCode: "FID2026-RDA",
      isPublished: true,
      sortOrder: 1,
      rates: [
        { roomType: "Studio", price: 45000, conditions: "Nettoyage quotidien" },
        { roomType: "Appartement deux pièces", price: 68000, conditions: null },
      ],
    },
  ] as const;

  for (const { rates, ...hotel } of hotelsData) {
    const existant = await prisma.hotel.findFirst({
      where: { editionId: edition.id, name: hotel.name },
    });
    const enregistre = existant
      ? await prisma.hotel.update({ where: { id: existant.id }, data: hotel })
      : await prisma.hotel.create({ data: { ...hotel, editionId: edition.id } });

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
    if (existant) {
      await prisma.practicalContact.update({ where: { id: existant.id }, data: contact });
    } else {
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
        "Bonjour {{prenom}},\n\nVotre participation au Forum international sur les données est confirmée. Retrouvez vos informations dans votre espace : {{lien_espace}}\n{{referent_bloc}}\n\nCordialement,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nYour participation in the International Data Forum is confirmed. Find your details in your personal space: {{lien_espace}}\n{{referent_bloc}}\n\nBest regards,\nThe organising committee",
      // `referent_bloc` est un paragraphe entier, composé côté serveur et vide
      // quand le participant n'a pas de délégation : le moteur ne sait pas
      // conditionner, et une phrase à trous aurait été envoyée telle quelle.
      variables: ["prenom", "lien_espace", "referent_bloc"],
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
        "Bonjour {{prenom}},\n\nLe Forum international sur les données ouvre dans une semaine, du 23 au 25 novembre 2026 à l'Hôtel King Fahd Palace, à Dakar.\n\nPensez à télécharger votre badge avant de venir : il vous sera demandé à l'entrée. Retrouvez-le dans votre espace : {{lien_espace}}\n\nÀ très bientôt,\nLe comité d'organisation",
      bodyEn:
        "Hello {{prenom}},\n\nThe International Data Forum opens in one week, from 23 to 25 November 2026 at the King Fahd Palace Hotel in Dakar.\n\nPlease download your badge before you come: it will be checked at the entrance. Find it in your personal space: {{lien_espace}}\n\nSee you soon,\nThe organising committee",
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
      update: tpl,
      create: { ...tpl, channel: "EMAIL", editionId: edition.id },
    });
  }

  // ---------------------------------------------------------------------
  // Participants et délégations [DEMO] (brief §11) — jeu restreint pour
  // exercer le module 3.1 ; complété au fil des modules restants (T10).
  // ---------------------------------------------------------------------
  const delegationMali = await upsertDelegation(edition.id, {
    name: "Délégation du Mali [DEMO]",
    country: "Mali",
    institution: "INSTAT Mali",
  });
  const delegationCotedIvoire = await upsertDelegation(edition.id, {
    name: "Délégation de Côte d'Ivoire [DEMO]",
    country: "Côte d'Ivoire",
    institution: "ANStat",
  });

  const demoParticipants: Array<{
    firstName: string;
    lastName: string;
    email: string;
    country: string;
    organization: string;
    jobTitle: string;
    categoryCode: string;
    source: "ONLINE" | "ONSITE";
    delegationId?: string;
    after?: "confirm" | "decline" | "cancel";
  }> = [
    {
      firstName: "Aminata",
      lastName: "Sow",
      email: "demo.aminata.sow@ansd.sn",
      country: "Sénégal",
      organization: "ANSD",
      jobTitle: "Directrice des statistiques démographiques",
      categoryCode: "PERSONNEL_ANSD",
      source: "ONLINE",
    },
    {
      firstName: "Oumar",
      lastName: "Ba",
      email: "demo.oumar.ba@ansd.sn",
      country: "Sénégal",
      organization: "ANSD",
      jobTitle: "Directeur général",
      categoryCode: "PERSONNEL_ANSD",
      source: "ONLINE",
    },
    {
      firstName: "Ibrahima",
      lastName: "Koné",
      email: "demo.ibrahima.kone@instat.gov.ml",
      country: "Mali",
      organization: "INSTAT Mali",
      jobTitle: "Directeur général",
      categoryCode: "INS",
      source: "ONLINE",
      delegationId: delegationMali.id,
      after: "confirm",
    },
    {
      firstName: "Mariam",
      lastName: "Diallo",
      email: "demo.mariam.diallo@anstat.ci",
      country: "Côte d'Ivoire",
      organization: "ANStat",
      jobTitle: "Cheffe de service Recensement",
      categoryCode: "INS",
      source: "ONLINE",
      delegationId: delegationCotedIvoire.id,
      after: "confirm",
    },
    {
      firstName: "Kwame",
      lastName: "Osei",
      email: "demo.kwame.osei@statsghana.gov.gh",
      country: "Ghana",
      organization: "Ghana Statistical Service",
      jobTitle: "Deputy Government Statistician",
      categoryCode: "INS",
      source: "ONLINE",
    },
    {
      firstName: "Julie",
      lastName: "Lambert",
      email: "demo.julie.lambert@unfpa.org",
      country: "France",
      organization: "UNFPA",
      jobTitle: "Conseillère régionale",
      categoryCode: "ORG_INTERNATIONALE",
      source: "ONLINE",
      after: "confirm",
    },
    {
      firstName: "Paul",
      lastName: "Tchoua",
      email: "demo.paul.tchoua@afristat.org",
      country: "Mali",
      organization: "AFRISTAT",
      jobTitle: "Directeur général",
      categoryCode: "ORG_INTERNATIONALE",
      source: "ONLINE",
    },
    {
      firstName: "Fatou",
      lastName: "Ndiaye",
      email: "demo.fatou.ndiaye@ansd.sn",
      country: "Sénégal",
      organization: "ANSD",
      jobTitle: "Directrice des systèmes d'information",
      categoryCode: "PERSONNEL_ANSD",
      source: "ONLINE",
    },
    {
      firstName: "Grace",
      lastName: "Mensah",
      email: "demo.grace.mensah@statsghana.gov.gh",
      country: "Ghana",
      organization: "GSS",
      jobTitle: "Chargée de communication",
      categoryCode: "MEDIA",
      source: "ONLINE",
    },
    {
      firstName: "Moussa",
      lastName: "Fall",
      email: "demo.moussa.fall@lesoleil.sn",
      country: "Sénégal",
      organization: "Le Soleil",
      jobTitle: "Journaliste",
      categoryCode: "MEDIA",
      source: "ONLINE",
    },
    {
      firstName: "Oulimata",
      lastName: "Sarr",
      email: "demo.oulimata.sarr@economie.gouv.sn",
      country: "Sénégal",
      organization: "MEPC",
      jobTitle: "Ministre",
      categoryCode: "AUTORITE_VIP",
      source: "ONSITE",
    },
    {
      firstName: "Cheikh",
      lastName: "Diop",
      email: "demo.cheikh.diop@banquemondiale.org",
      country: "États-Unis",
      organization: "Banque mondiale",
      jobTitle: "Économiste senior",
      categoryCode: "PTF",
      source: "ONLINE",
      after: "confirm",
    },
    {
      firstName: "Awa",
      lastName: "Traoré",
      email: "demo.awa.traore@undp.org",
      country: "Sénégal",
      organization: "PNUD",
      jobTitle: "Chargée de programme",
      categoryCode: "PTF",
      source: "ONLINE",
    },
    {
      firstName: "Jean",
      lastName: "Kouassi",
      email: "demo.jean.kouassi@ensae.sn",
      country: "Côte d'Ivoire",
      organization: "ENSAE Dakar",
      jobTitle: "Enseignant-chercheur",
      categoryCode: "PARTICIPANT_INTERNATIONAL",
      source: "ONLINE",
      delegationId: delegationCotedIvoire.id,
    },
    {
      firstName: "Bineta",
      lastName: "Cissé",
      email: "demo.bineta.cisse@sonatel.sn",
      country: "Sénégal",
      organization: "Sonatel",
      jobTitle: "Responsable RSE",
      categoryCode: "SPONSOR",
      source: "ONLINE",
    },
    {
      firstName: "Modibo",
      lastName: "Coulibaly",
      email: "demo.modibo.coulibaly@instat.gov.ml",
      country: "Mali",
      organization: "INSTAT Mali",
      jobTitle: "Statisticien",
      categoryCode: "INS",
      source: "ONLINE",
      delegationId: delegationMali.id,
      after: "decline",
    },
    {
      firstName: "Aïssatou",
      lastName: "Barry",
      email: "demo.aissatou.barry@statsguinee.org",
      country: "Guinée",
      organization: "INS Guinée",
      jobTitle: "Directrice adjointe",
      categoryCode: "INS",
      source: "ONLINE",
      after: "cancel",
    },
    {
      firstName: "Khadija",
      lastName: "Ndour",
      email: "demo.khadija.ndour@ansd.sn",
      country: "Sénégal",
      organization: "ANSD",
      jobTitle: "Chargée d'accueil",
      categoryCode: "PRESTATAIRE",
      source: "ONSITE",
    },
  ];

  for (const demo of demoParticipants) {
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
        delegationId: demo.delegationId,
        locale: "fr",
        attendsOpening: true,
        attendsInaugural: true,
        attendsAwards: false,
        needsAccommodation: demo.source === "ONLINE" && demo.country !== "Sénégal",
        needsTransport: false,
        notes: "[DEMO] Participant fictif — jeu de données de démonstration.",
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
  // Invitations [DEMO] — sans elles, l'entonnoir du tableau de bord (3.9)
  // n'a aucune donnée à montrer. Quelques-unes sont rattachées à des
  // participants existants pour que la conversion soit réaliste.
  // ---------------------------------------------------------------------
  const invitationSeeds: {
    firstName: string;
    lastName: string;
    email: string;
    country: string;
    organization: string;
    categoryCode: keyof typeof categories;
    /** Étape atteinte : jusqu'où l'invitation est allée. */
    stage: "PENDING" | "SENT" | "OPENED" | "CLICKED" | "REGISTERED";
    /** E-mail d'un participant [DEMO] existant à rattacher, pour l'étape REGISTERED. */
    linkTo?: string;
  }[] = [
    {
      firstName: "Aminata",
      lastName: "Sow",
      email: "demo.aminata.sow@ansd.sn",
      country: "Sénégal",
      organization: "ANSD",
      categoryCode: "PERSONNEL_ANSD",
      stage: "REGISTERED",
      linkTo: "demo.aminata.sow@ansd.sn",
    },
    {
      firstName: "Ibrahima",
      lastName: "Koné",
      email: "demo.ibrahima.kone@instat.gov.ml",
      country: "Mali",
      organization: "INSTAT",
      categoryCode: "INS",
      stage: "REGISTERED",
      linkTo: "demo.ibrahima.kone@instat.gov.ml",
    },
    {
      firstName: "Mariam",
      lastName: "Diallo",
      email: "demo.mariam.diallo@anstat.ci",
      country: "Côte d'Ivoire",
      organization: "ANSTAT",
      categoryCode: "INS",
      stage: "REGISTERED",
      linkTo: "demo.mariam.diallo@anstat.ci",
    },
    {
      firstName: "Kwame",
      lastName: "Osei",
      email: "demo.kwame.osei@statsghana.gov.gh",
      country: "Ghana",
      organization: "Ghana Statistical Service",
      categoryCode: "INS",
      stage: "REGISTERED",
      linkTo: "demo.kwame.osei@statsghana.gov.gh",
    },
    {
      firstName: "Aïcha",
      lastName: "Traoré",
      email: "demo.inv.aicha.traore@insd.bf",
      country: "Burkina Faso",
      organization: "INSD",
      categoryCode: "INS",
      stage: "CLICKED",
    },
    {
      firstName: "Paulo",
      lastName: "Mendes",
      email: "demo.inv.paulo.mendes@ine.cv",
      country: "Cabo Verde",
      organization: "INE",
      categoryCode: "INS",
      stage: "CLICKED",
    },
    {
      firstName: "Fatima",
      lastName: "El Amrani",
      email: "demo.inv.fatima.elamrani@hcp.ma",
      country: "Maroc",
      organization: "HCP",
      categoryCode: "INS",
      stage: "OPENED",
    },
    {
      firstName: "Joseph",
      lastName: "Mwangi",
      email: "demo.inv.joseph.mwangi@knbs.or.ke",
      country: "Kenya",
      organization: "KNBS",
      categoryCode: "INS",
      stage: "OPENED",
    },
    {
      firstName: "Nadia",
      lastName: "Bensaïd",
      email: "demo.inv.nadia.bensaid@ons.dz",
      country: "Algérie",
      organization: "ONS",
      categoryCode: "INS",
      stage: "SENT",
    },
    {
      firstName: "Samuel",
      lastName: "Okoro",
      email: "demo.inv.samuel.okoro@nbs.gov.ng",
      country: "Nigeria",
      organization: "NBS",
      categoryCode: "INS",
      stage: "SENT",
    },
    {
      firstName: "Lucie",
      lastName: "Rakoto",
      email: "demo.inv.lucie.rakoto@instat.mg",
      country: "Madagascar",
      organization: "INSTAT",
      categoryCode: "INS",
      stage: "SENT",
    },
    {
      firstName: "Omar",
      lastName: "Haidara",
      email: "demo.inv.omar.haidara@ansd.sn",
      country: "Sénégal",
      organization: "Ministère du Plan",
      categoryCode: "AUTORITE_VIP",
      stage: "PENDING",
    },
    {
      firstName: "Rita",
      lastName: "Nkosi",
      email: "demo.inv.rita.nkosi@statssa.gov.za",
      country: "Afrique du Sud",
      organization: "Stats SA",
      categoryCode: "INS",
      stage: "PENDING",
    },
  ];

  // Le modèle `Invitation` n'a pas d'horodatage de clic (seulement le statut) :
  // seules les dates d'envoi et d'ouverture sont posées ici.
  const STAGE_DATES: Record<string, { sent: boolean; opened: boolean }> = {
    PENDING: { sent: false, opened: false },
    SENT: { sent: true, opened: false },
    OPENED: { sent: true, opened: true },
    CLICKED: { sent: true, opened: true },
    REGISTERED: { sent: true, opened: true },
  };

  for (const seed of invitationSeeds) {
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
      update: { valueFr: value.fr, valueEn: value.en },
      create: { editionId: edition.id, key, valueFr: value.fr, valueEn: value.en },
    });
  }

  // ---------------------------------------------------------------------
  // Sponsors [DEMO]
  // ---------------------------------------------------------------------
  const sponsorsData = [
    { name: "Banque mondiale", levelCode: "PRINCIPAL" },
    { name: "BAD", levelCode: "GOLD" },
    { name: "Union européenne", levelCode: "GOLD" },
    { name: "UNFPA", levelCode: "SILVER" },
    { name: "UNICEF", levelCode: "SILVER" },
    { name: "PNUD", levelCode: "SILVER" },
    { name: "AFRISTAT", levelCode: "INSTITUTIONNEL" },
    { name: "UNECA", levelCode: "INSTITUTIONNEL" },
    { name: "PARIS21", levelCode: "TECHNIQUE" },
    { name: "RTS", levelCode: "MEDIA" },
  ];

  for (const sponsor of sponsorsData) {
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
  // Actualités [DEMO]
  // ---------------------------------------------------------------------
  const postsData = [
    {
      slug: "ouverture-des-inscriptions-le-5-octobre",
      titleFr: "Ouverture des inscriptions le 5 octobre",
      titleEn: "Registrations open on 5 October",
      bodyFr:
        "[DEMO] Les délégations invitées recevront un lien personnalisé d'inscription. La validation est automatique pour certaines catégories, manuelle pour les autres.",
      bodyEn:
        "[DEMO] Invited delegations will receive a personalised registration link. Validation is automatic for some categories, manual for others.",
      daysAgo: 5,
    },
    {
      slug: "programme-provisoire-en-ligne",
      titleFr: "Programme provisoire en ligne",
      titleEn: "Provisional programme online",
      bodyFr:
        "[DEMO] Dix-huit panels sont prévus sur trois journées thématiques. Le détail sera publié avec le module Programme.",
      bodyEn:
        "[DEMO] Eighteen panels are planned over three themed days. Details will be published with the Programme module.",
      daysAgo: 12,
    },
    {
      slug: "appel-a-contributions",
      titleFr: "Appel à contributions",
      titleEn: "Call for contributions",
      bodyFr:
        "[DEMO] Les panélistes pourront déposer leur présentation depuis leur espace jusqu'au 10 novembre.",
      bodyEn:
        "[DEMO] Panellists will be able to submit their presentation from their space until 10 November.",
      daysAgo: 20,
    },
  ];

  for (const post of postsData) {
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

  console.log(`Seed terminé pour l'édition ${edition.code}.`);
  console.log(`Compte de démonstration : superadmin@ansd.sn / ${superAdminPassword}`);
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
