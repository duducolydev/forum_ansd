/**
 * Programme officiel du Forum (note conceptuelle du 24 septembre 2026, §III et
 * §IV), chargé par `scripts/programme-officiel.ts`.
 *
 * Repris tel quel de la note, avec trois choix :
 *
 * - **les trous de l'horaire sont des pauses** (consigne du comité, 23 octobre
 *   2026) : pause-café le matin, déjeuner à la mi-journée. Elles n'ont pas de
 *   salle et barrent la frise, comme dans le reste du programme ;
 * - **« Panel N — » ouvre le titre** : le numéro de séance ne s'affiche pas sur
 *   le site, et c'est par lui que la note et le comité désignent les panels.
 *   Le même numéro sert à rattacher les intervenants à l'import ;
 * - **les intitulés du tableau des panels** (§III), plus complets que ceux de
 *   l'horaire. Pour le panel 2, la seconde ligne du tableau (« Les métiers de la
 *   statistique… ») n'est pas reprise : c'est l'intitulé du panel 8, recopié.
 *
 * S'y ajoute, à la demande du comité (23 octobre 2026), **l'exposition des
 * stands**, ouverte toute la journée pendant les trois jours : une séance par
 * jour, du premier au dernier créneau, dans son propre lieu (« Espace
 * d'exposition »). Sans lieu, la vue « par salle » l'aurait étalée sur toute la
 * largeur — c'est ainsi qu'elle montre les moments communs — et elle aurait
 * recouvert la journée entière.
 *
 * Les traductions anglaise et portugaise sont proposées ici ; le comité les
 * relit et les corrige en BackOffice. Aucun texte de description n'est inventé :
 * seules les séances que la note décrit en ont un.
 */
import { sessionInputSchema, type SessionInput } from "../src/modules/sessions/schema";

export type SalleProgramme = "AMPHITHEATRE" | "PLENIERE" | "EXPOSITION";

export interface SeanceOfficielle {
  /** Adresse stable : c'est elle qui rend le chargement rejouable sans doublon. */
  slug: string;
  type: "OPENING" | "PANEL" | "BREAK" | "LUNCH" | "PLENARY" | "AWARDS" | "CLOSING" | "SIDE_EVENT";
  /** Numéro du panel dans la note (1 à 10). */
  numero?: number;
  jour: string;
  debut: string;
  fin: string;
  salle?: SalleProgramme;
  /** Se tient en parallèle de toute la journée (l'exposition des stands). */
  enContinu?: true;
  titre: { fr: string; en: string; pt: string };
  description?: { fr: string; en: string; pt: string };
}

/**
 * Salles du programme, et les noms sous lesquels elles peuvent figurer en base :
 * le seed a créé les deux salles de la note le 24 septembre sous les noms des
 * zones d'accès. Seul l'espace d'exposition, que rien n'a créé, l'est par le
 * chargement s'il manque (`creer`) ; les deux salles ne sont jamais créées ni
 * renommées.
 */
export const SALLES_PROGRAMME: Record<
  SalleProgramme,
  { libelle: string; noms: string[]; creer?: boolean }
> = {
  AMPHITHEATRE: { libelle: "Amphithéâtre", noms: ["Amphithéâtre", "Salle d'Ouverture"] },
  PLENIERE: { libelle: "Salle plénière", noms: ["Salle plénière", "Salle de Plénière"] },
  EXPOSITION: { libelle: "Espace d'exposition", noms: ["Espace d'exposition"], creer: true },
};

const PAUSE_CAFE = { fr: "Pause-café", en: "Coffee break", pt: "Pausa para café" };
const DEJEUNER = { fr: "Déjeuner", en: "Lunch", pt: "Almoço" };

/** Exposition des stands d'une journée, du premier au dernier créneau. */
function exposition(jour: string, debut: string, fin: string): SeanceOfficielle {
  return {
    slug: `exposition-des-stands-${jour.slice(8)}-novembre`,
    type: "SIDE_EVENT",
    jour,
    debut,
    fin,
    salle: "EXPOSITION",
    enContinu: true,
    titre: {
      fr: "Exposition des stands",
      en: "Stands exhibition",
      pt: "Exposição dos stands",
    },
    description: {
      fr: "Les stands sont ouverts tout au long de la journée.",
      en: "The stands are open throughout the day.",
      pt: "Os stands estão abertos durante todo o dia.",
    },
  };
}

export const PROGRAMME_OFFICIEL: SeanceOfficielle[] = [
  // --- Jour 1 — lundi 23 novembre : ouverture officielle, panels 1 à 3 ---------
  exposition("2026-11-23", "08:00", "17:00"),
  {
    slug: "ceremonie-officielle-d-ouverture",
    type: "OPENING",
    jour: "2026-11-23",
    debut: "08:00",
    fin: "10:00",
    salle: "AMPHITHEATRE",
    titre: {
      fr: "Cérémonie officielle d'ouverture",
      en: "Official opening ceremony",
      pt: "Cerimónia oficial de abertura",
    },
    description: {
      fr: "Accueil des officiels et des invités, puis cérémonie officielle d'ouverture sous la présidence du Président de la République.",
      en: "Welcome of officials and guests, followed by the official opening ceremony chaired by the President of the Republic.",
      pt: "Acolhimento das autoridades e dos convidados, seguido da cerimónia oficial de abertura sob a presidência do Presidente da República.",
    },
  },
  {
    slug: "panel-1-panel-ministeriel-de-haut-niveau",
    type: "PANEL",
    numero: 1,
    jour: "2026-11-23",
    debut: "10:00",
    fin: "11:00",
    salle: "AMPHITHEATRE",
    titre: {
      fr: "Panel 1 — Panel ministériel de haut niveau : apport de la donnée et de la statistique au développement de nos pays",
      en: "Panel 1 — High-level ministerial panel: the contribution of data and statistics to our countries' development",
      pt: "Painel 1 — Painel ministerial de alto nível: o contributo dos dados e da estatística para o desenvolvimento dos nossos países",
    },
    description: {
      fr: "Conférence inaugurale de haut niveau et panel ministériel, sur le thème central du Forum : « Gouvernance économique et sociale : la donnée au cœur du développement ».",
      en: "High-level inaugural lecture and ministerial panel on the Forum's central theme: “Economic and social governance: data at the heart of development”.",
      pt: "Conferência inaugural de alto nível e painel ministerial sobre o tema central do Fórum: «Governação económica e social: os dados no centro do desenvolvimento».",
    },
  },
  {
    slug: "pause-cafe-23-novembre",
    type: "BREAK",
    jour: "2026-11-23",
    debut: "11:00",
    fin: "11:30",
    titre: PAUSE_CAFE,
  },
  {
    slug: "panel-2-souverainete-et-financement-de-la-statistique-publique",
    type: "PANEL",
    numero: 2,
    jour: "2026-11-23",
    debut: "11:30",
    fin: "13:30",
    salle: "AMPHITHEATRE",
    titre: {
      fr: "Panel 2 — Souveraineté et financement de la statistique publique : quel modèle durable ?",
      en: "Panel 2 — Sovereignty and financing of official statistics: what sustainable model?",
      pt: "Painel 2 — Soberania e financiamento da estatística pública: que modelo sustentável?",
    },
  },
  {
    slug: "dejeuner-23-novembre",
    type: "LUNCH",
    jour: "2026-11-23",
    debut: "13:30",
    fin: "15:00",
    titre: DEJEUNER,
  },
  {
    slug: "panel-3-securisation-des-donnees",
    type: "PANEL",
    numero: 3,
    jour: "2026-11-23",
    debut: "15:00",
    fin: "17:00",
    salle: "PLENIERE",
    titre: {
      fr: "Panel 3 — Sécurisation des données dans un contexte d'interopérabilité et de digitalisation",
      en: "Panel 3 — Securing data in a context of interoperability and digitalisation",
      pt: "Painel 3 — Segurança dos dados num contexto de interoperabilidade e digitalização",
    },
  },

  // --- Jour 2 — mardi 24 novembre : panels thématiques 4 à 7 --------------------
  exposition("2026-11-24", "09:00", "17:30"),
  {
    slug: "panel-4-les-donnees-au-service-de-l-inclusion-des-femmes",
    type: "PANEL",
    numero: 4,
    jour: "2026-11-24",
    debut: "09:00",
    fin: "10:30",
    salle: "PLENIERE",
    titre: {
      fr: "Panel 4 — Les données au service de l'inclusion des femmes",
      en: "Panel 4 — Data for women's inclusion",
      pt: "Painel 4 — Os dados ao serviço da inclusão das mulheres",
    },
  },
  {
    slug: "pause-cafe-24-novembre",
    type: "BREAK",
    jour: "2026-11-24",
    debut: "10:30",
    fin: "11:00",
    titre: PAUSE_CAFE,
  },
  {
    slug: "panel-5-nouvelles-sources-de-donnees",
    type: "PANEL",
    numero: 5,
    jour: "2026-11-24",
    debut: "11:00",
    fin: "13:00",
    salle: "PLENIERE",
    titre: {
      fr: "Panel 5 — Nouvelles sources de données : intégration des données géo-spatiales et des données cellulaires, quelles opportunités ?",
      en: "Panel 5 — New data sources: integrating geospatial and mobile phone data, what opportunities?",
      pt: "Painel 5 — Novas fontes de dados: integração de dados geoespaciais e de dados de telemóvel, que oportunidades?",
    },
  },
  {
    slug: "dejeuner-24-novembre",
    type: "LUNCH",
    jour: "2026-11-24",
    debut: "13:00",
    fin: "14:30",
    titre: DEJEUNER,
  },
  {
    slug: "panel-6-donnees-climatiques-et-agricoles",
    type: "PANEL",
    numero: 6,
    jour: "2026-11-24",
    debut: "14:30",
    fin: "16:00",
    salle: "PLENIERE",
    titre: {
      fr: "Panel 6 — Données climatiques et agricoles : mesurer pour agir",
      en: "Panel 6 — Climate and agricultural data: measuring to act",
      pt: "Painel 6 — Dados climáticos e agrícolas: medir para agir",
    },
  },
  {
    slug: "panel-7-le-pari-demographique-jeunesse-et-emploi",
    type: "PANEL",
    numero: 7,
    jour: "2026-11-24",
    debut: "16:00",
    fin: "17:30",
    salle: "PLENIERE",
    titre: {
      fr: "Panel 7 — Le pari démographique : jeunesse et emploi",
      en: "Panel 7 — The demographic bet: youth and employment",
      pt: "Painel 7 — A aposta demográfica: juventude e emprego",
    },
  },

  // --- Jour 3 — mercredi 25 novembre : panels 8 à 10, synthèse et clôture ------
  exposition("2026-11-25", "09:00", "19:00"),
  {
    slug: "panel-8-les-metiers-de-la-statistique",
    type: "PANEL",
    numero: 8,
    jour: "2026-11-25",
    debut: "09:00",
    fin: "10:30",
    salle: "PLENIERE",
    titre: {
      fr: "Panel 8 — Les métiers de la statistique face à la révolution des données : quelles compétences pour demain ?",
      en: "Panel 8 — Statistical professions and the data revolution: what skills for tomorrow?",
      pt: "Painel 8 — As profissões da estatística perante a revolução dos dados: que competências para amanhã?",
    },
  },
  {
    slug: "pause-cafe-25-novembre",
    type: "BREAK",
    jour: "2026-11-25",
    debut: "10:30",
    fin: "11:00",
    titre: PAUSE_CAFE,
  },
  {
    slug: "panel-9-assurance-qualite-et-harmonisation-des-methodes",
    type: "PANEL",
    numero: 9,
    jour: "2026-11-25",
    debut: "11:00",
    fin: "12:30",
    salle: "PLENIERE",
    titre: {
      fr: "Panel 9 — Assurance qualité et harmonisation des méthodes : enjeux et défis",
      en: "Panel 9 — Quality assurance and harmonisation of methods: issues and challenges",
      pt: "Painel 9 — Garantia da qualidade e harmonização dos métodos: questões e desafios",
    },
  },
  {
    slug: "dejeuner-25-novembre",
    type: "LUNCH",
    jour: "2026-11-25",
    debut: "12:30",
    fin: "14:30",
    titre: DEJEUNER,
  },
  {
    slug: "panel-10-coordination-statistique-et-ressources-humaines",
    type: "PANEL",
    numero: 10,
    jour: "2026-11-25",
    debut: "14:30",
    fin: "16:00",
    salle: "PLENIERE",
    titre: {
      fr: "Panel 10 — Coordination statistique et gestion des ressources humaines au sein d'un SSN : enjeux et défis",
      en: "Panel 10 — Statistical coordination and human resource management within a national statistical system: issues and challenges",
      pt: "Painel 10 — Coordenação estatística e gestão dos recursos humanos num sistema estatístico nacional: questões e desafios",
    },
  },
  {
    slug: "synthese-generale-et-recommandations",
    type: "PLENARY",
    jour: "2026-11-25",
    debut: "16:00",
    fin: "17:00",
    salle: "PLENIERE",
    titre: {
      fr: "Synthèse générale des travaux et lecture des recommandations",
      en: "General summary of the proceedings and reading of the recommendations",
      pt: "Síntese geral dos trabalhos e leitura das recomendações",
    },
  },
  {
    slug: "distinctions-laureats-et-pionniers-de-la-statistique",
    type: "AWARDS",
    jour: "2026-11-25",
    debut: "17:00",
    fin: "18:00",
    salle: "PLENIERE",
    titre: {
      fr: "Distinction des lauréats et des pionniers de la statistique",
      en: "Awards for the winners and the pioneers of statistics",
      pt: "Distinção dos vencedores e dos pioneiros da estatística",
    },
    description: {
      fr: "Distinction des lauréats du Hackathon et du concours de data journalisme, puis des pionniers de la statistique.",
      en: "Awards for the winners of the Hackathon and of the data journalism competition, followed by the pioneers of statistics.",
      pt: "Distinção dos vencedores do Hackathon e do concurso de jornalismo de dados, seguida dos pioneiros da estatística.",
    },
  },
  {
    slug: "ceremonie-officielle-de-cloture",
    type: "CLOSING",
    jour: "2026-11-25",
    debut: "18:00",
    fin: "19:00",
    salle: "PLENIERE",
    titre: {
      fr: "Cérémonie officielle de clôture, suivie d'un cocktail",
      en: "Official closing ceremony, followed by a cocktail reception",
      pt: "Cerimónia oficial de encerramento, seguida de um cocktail",
    },
  },
];

/**
 * Séance du programme, au format du formulaire du BackOffice : validée par le
 * même schéma, elle est créée par le même service (`createSession`).
 *
 * Publiée, sans réservation : la note ne donne aucune capacité, et ouvrir les
 * inscriptions reste une décision du comité, séance par séance.
 */
export function versSessionInput(
  seance: SeanceOfficielle,
  salles: Partial<Record<SalleProgramme, string>>,
): SessionInput {
  const roomId = seance.salle ? salles[seance.salle] : undefined;
  if (seance.salle && !roomId) {
    throw new Error(`Salle « ${SALLES_PROGRAMME[seance.salle].libelle} » introuvable.`);
  }
  return sessionInputSchema.parse({
    slug: seance.slug,
    type: seance.type,
    number: seance.numero,
    titleFr: seance.titre.fr,
    titleEn: seance.titre.en,
    titlePt: seance.titre.pt,
    descriptionFr: seance.description?.fr ?? "",
    descriptionEn: seance.description?.en ?? "",
    descriptionPt: seance.description?.pt ?? "",
    day: seance.jour,
    startTime: seance.debut,
    endTime: seance.fin,
    roomId: roomId ?? "",
    registrationOpen: false,
    isPublished: true,
  });
}
