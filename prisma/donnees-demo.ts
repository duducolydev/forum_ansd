/**
 * Données de démonstration (brief §11) — leur source unique.
 *
 * Le seed les écrit sur une base **de développement**, à la demande
 * (`SEED_DEMO=1` ou `pnpm db:seed --demo`), et jamais en production
 * (`prisma/seed-decision.ts`). `scripts/purger-demo.ts` s'en sert dans l'autre
 * sens : retrouver ces fiches sur une base en service et les retirer. D'où une
 * source unique — une fiche ajoutée ici est, du même coup, une fiche que le
 * nettoyage sait reconnaître.
 *
 * Tout ce qui est fictif porte une marque visible : `[DEMO]` dans un nom, une
 * description ou une note, une adresse en `demo.` ou sur le domaine réservé
 * `.test`, qui ne peut appartenir à personne.
 */

/** Compte BackOffice de démonstration, au mot de passe publié dans le README. */
export const SUPERADMIN_DEMO = {
  email: "superadmin@ansd.sn",
  nom: "Super Administrateur [DEMO]",
} as const;

/** Note posée sur chaque participant de démonstration. */
export const NOTE_PARTICIPANT_DEMO = "[DEMO] Participant fictif — jeu de données de démonstration.";

// ---------------------------------------------------------------------------
// Intervenants et programme (brief §11, §5.8)
// ---------------------------------------------------------------------------

export const INTERVENANTS_DEMO = [
  ["Oulimata", "Sarr", "Ministre", "Ministère de l'Économie et du Plan", "Sénégal"],
  ["Abdou", "Diouf", "Directeur général", "ANSD", "Sénégal"],
  ["Ibrahima", "Koné", "Directeur général", "INSTAT Mali", "Mali"],
  ["Mariam", "Diallo", "Cheffe de service Recensement", "ANStat", "Côte d'Ivoire"],
  ["Kwame", "Osei", "Deputy Government Statistician", "Ghana Statistical Service", "Ghana"],
  ["Julie", "Lambert", "Conseillère régionale", "UNFPA", "France"],
  ["Paul", "Tchoua", "Directeur général", "AFRISTAT", "Mali"],
  ["Aminata", "Sow", "Directrice des statistiques démographiques", "ANSD", "Sénégal"],
] as const;

/** Adresse d'un intervenant de démonstration : sur `.test`, domaine réservé qui ne reçoit rien. */
export function emailIntervenantDemo(firstName: string, lastName: string): string {
  return `demo.speaker.${firstName}.${lastName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]/g, "")
    .concat("@example.test");
}

export function bioIntervenantDemo(
  firstName: string,
  lastName: string,
  organization: string,
): string {
  return `[DEMO] ${firstName} ${lastName} intervient au Forum au titre de ses fonctions à ${organization}.`;
}

// Trois journées, dix sessions par jour (brief §11). Les moments communs
// (ouverture, pauses, déjeuner) n'ont pas de salle : ils barrent la grille.
export const JOURS_DEMO = ["2026-11-23", "2026-11-24", "2026-11-25"] as const;

export type SeanceDemo = {
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

/*
 * Deux salles depuis le 24 septembre 2026 : le programme a été redistribué sur
 * la Salle d'Ouverture et la Salle de Plénière, sans qu'aucune séance n'en
 * occupe une déjà prise — vérifié séance par séance.
 */
export const PROGRAMME_DEMO: Record<string, SeanceDemo[]> = {
  "2026-11-23": [
    {
      type: "OPENING",
      titleFr: "Cérémonie d'ouverture",
      titleEn: "Opening ceremony",
      start: "09:00",
      end: "10:00",
      speakers: [
        ["Oulimata Sarr", "KEYNOTE"],
        ["Abdou Diouf", "MODERATOR"],
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
        ["Abdou Diouf", "PANELIST"],
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
      speakers: [["Abdou Diouf", "MODERATOR"]],
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
      speakers: [["Abdou Diouf", "MODERATOR"]],
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
        ["Abdou Diouf", "MODERATOR"],
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
        ["Abdou Diouf", "MODERATOR"],
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

export function slugSeanceDemo(jour: string, titre: string): string {
  const base = titre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return `${base}-${jour.slice(5).replace("-", "")}`;
}

export function descriptionSeanceDemo(titre: string): string {
  return `[DEMO] ${titre}. Description à remplacer par le comité scientifique.`;
}

// ---------------------------------------------------------------------------
// Hébergement (§29) : deux hôtels pour exercer la page de détail, ses tableaux
// de tarifs et le tri par distance, sans prétendre à un état réel des accords.
// ---------------------------------------------------------------------------

export const HOTELS_DEMO = [
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
    descriptionEn: "Serviced studios, with a morning and evening shuttle to the King Fahd Palace.",
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

// ---------------------------------------------------------------------------
// Participants et délégations (brief §11) — jeu restreint pour exercer le
// module 3.1.
// ---------------------------------------------------------------------------

export const DELEGATIONS_DEMO = {
  MALI: { name: "Délégation du Mali [DEMO]", country: "Mali", institution: "INSTAT Mali" },
  COTE_IVOIRE: {
    name: "Délégation de Côte d'Ivoire [DEMO]",
    country: "Côte d'Ivoire",
    institution: "ANStat",
  },
} as const;

export interface ParticipantDemo {
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  organization: string;
  jobTitle: string;
  categoryCode: string;
  source: "ONLINE" | "ONSITE";
  delegation?: keyof typeof DELEGATIONS_DEMO;
  after?: "confirm" | "decline" | "cancel";
}

export const PARTICIPANTS_DEMO: ParticipantDemo[] = [
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
    firstName: "Abdou",
    lastName: "Diouf",
    email: "abdou.diouf@ansd.sn",
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
    delegation: "MALI",
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
    delegation: "COTE_IVOIRE",
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
    delegation: "COTE_IVOIRE",
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
    delegation: "MALI",
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

// ---------------------------------------------------------------------------
// Invitations — sans elles, l'entonnoir du tableau de bord (3.9) n'a aucune
// donnée à montrer. Quelques-unes sont rattachées à des participants de
// démonstration, pour que la conversion soit réaliste.
// ---------------------------------------------------------------------------

export interface InvitationDemo {
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  organization: string;
  categoryCode: string;
  /** Étape atteinte : jusqu'où l'invitation est allée. */
  stage: "PENDING" | "SENT" | "OPENED" | "CLICKED" | "REGISTERED";
  /** E-mail d'un participant [DEMO] existant à rattacher, pour l'étape REGISTERED. */
  linkTo?: string;
}

export const INVITATIONS_DEMO: InvitationDemo[] = [
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

// ---------------------------------------------------------------------------
// Partenaires et actualités
// ---------------------------------------------------------------------------

export const PARTENAIRES_DEMO = [
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

export const ACTUALITES_DEMO = [
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
