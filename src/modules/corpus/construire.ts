import { localeIntl, selon, traduire, type Langue } from "@/lib/langue";
import { lireTexteRiche, texteBrut } from "@/lib/texte-riche";
import { typeSection } from "@/modules/sections/catalogue";
import { libelleRole, libelleType } from "@/modules/sessions/libelles";
import { SESSION_TYPES } from "@/modules/sessions/schema";
import { zoneEditoriale } from "@/modules/content/keys";
import { RUBRIQUES, libelle as libelleRubrique, type Rubrique } from "@/modules/hotels/rubriques";
import { REPERES } from "./reperes";
import type { DocumentCorpus } from "./types";

/**
 * Fabrique des documents du corpus : des lignes de la base vers du texte lisible.
 *
 * Toutes les fonctions de ce module sont **pures**. C'est délibéré : ce qui
 * peut se tromper ici, c'est le filtrage (publier un brouillon) et
 * l'aplatissement (livrer du JSON de mise en forme au lieu d'une phrase), et
 * les deux se vérifient sur des objets écrits à la main, sans base. Les
 * lectures vivent dans `service.ts`, qui ne fait que les appeler.
 *
 * Les paramètres sont décrits par des interfaces locales plutôt que par les
 * types Prisma : un document n'a besoin que d'une poignée de colonnes, et les
 * déclarer ici dit exactement lesquelles — c'est la liste de ce que le corpus
 * est autorisé à lire.
 */

// ---------------------------------------------------------------------------
// Outils communs
// ---------------------------------------------------------------------------

type Multilingue = {
  fr?: string | null;
  en?: string | null;
  pt?: string | null;
};

function dit(langue: Langue, valeurs: Multilingue): string {
  return traduire(langue, valeurs).trim();
}

/** Valeur mise en forme dans l'éditeur, réduite à son texte. */
function brut(langue: Langue, valeurs: Multilingue): string {
  return texteBrut(lireTexteRiche(traduire(langue, valeurs))).trim();
}

function iso(date: Date): string {
  return date.toISOString();
}

/** Jour seul, en `AAAA-MM-JJ` : la colonne est une date, lue en UTC. */
function jourIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Heure du programme, lue en UTC comme partout sur le site : les horaires sont
 * saisis en heure locale de Dakar, qui est UTC, et les convertir ici les
 * décalerait selon le fuseau du serveur.
 */
function heure(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, "0");
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function jourLong(date: Date, langue: Langue): string {
  return new Intl.DateTimeFormat(localeIntl(langue), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Assemble des lignes en écartant les vides : un corps sans trous à indexer. */
function lignes(...valeurs: (string | null | undefined)[]): string {
  return valeurs
    .map((valeur) => (valeur ?? "").trim())
    .filter((valeur) => valeur.length > 0)
    .join("\n\n");
}

/**
 * Libellé public d'un type de séance, ou le code si le type est inconnu.
 *
 * La colonne est une énumération Prisma, livrée ici comme une chaîne : plutôt
 * que de la forcer dans le type attendu, on vérifie qu'elle en fait partie. Un
 * type ajouté en base et pas encore traduit sort alors tel quel, au lieu de
 * faire tomber l'export entier.
 */
function libelleDuType(type: string, langue: Langue): string {
  return (SESSION_TYPES as readonly string[]).includes(type)
    ? libelleType(type as (typeof SESSION_TYPES)[number], langue)
    : type;
}

function sansVides(donnees: Record<string, string | number | null | undefined>) {
  const propres: Record<string, string | number> = {};
  for (const [cle, valeur] of Object.entries(donnees)) {
    if (valeur === null || valeur === undefined) continue;
    if (typeof valeur === "string" && valeur.trim().length === 0) continue;
    propres[cle] = valeur;
  }
  return Object.keys(propres).length > 0 ? propres : undefined;
}

// ---------------------------------------------------------------------------
// Repères
// ---------------------------------------------------------------------------

export function documentsReperes(langue: Langue): DocumentCorpus[] {
  // Pas de `maj` en base pour une table déclarée dans le code : l'horodatage de
  // l'export fait foi, et un repère changé part avec le déploiement.
  const maj = new Date().toISOString();

  return REPERES.map((repere) => ({
    id: `repere:${repere.cle}:${langue}`,
    type: "repere" as const,
    langue,
    url: repere.url,
    titre: selon(langue, repere.titre),
    resume: "",
    texte: selon(langue, repere.texte),
    ...(repere.connexionRequise ? { connexionRequise: true } : {}),
    maj,
  }));
}

// ---------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------

export interface LigneSession {
  id: string;
  slug: string;
  number: number | null;
  type: string;
  titleFr: string;
  titleEn: string;
  titlePt: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  descriptionPt: string | null;
  objectives: string | null;
  theme: string | null;
  day: Date;
  startTime: Date;
  endTime: Date;
  liveStreamUrl: string | null;
  tdrPath: string | null;
  updatedAt: Date;
  room: { name: string } | null;
  speakers: {
    role: string;
    speaker: {
      firstName: string;
      lastName: string;
      jobTitle: string | null;
      organization: string | null;
      country: string | null;
      isPublished: boolean;
    };
  }[];
}

/**
 * Une séance du programme.
 *
 * Les intervenants **non publiés** n'y figurent pas : la fiche publique les
 * écarte déjà (`programme/[slug]/page.tsx`), et un panéliste encore pressenti
 * annoncé par un assistant est un engagement pris à la place du comité.
 */
export function documentSession(session: LigneSession, langue: Langue): DocumentCorpus {
  const titre = dit(langue, {
    fr: session.titleFr,
    en: session.titleEn,
    pt: session.titlePt,
  });

  const type = libelleDuType(session.type, langue);
  const quand = `${jourLong(session.day, langue)}, ${heure(session.startTime)} – ${heure(session.endTime)}`;
  const salle = session.room
    ? selon(langue, { fr: "Salle", en: "Room", pt: "Sala" }) + ` ${session.room.name}`
    : "";

  const intervenants = session.speakers
    .filter((lien) => lien.speaker.isPublished)
    .map((lien) => {
      const personne = lien.speaker;
      const details = [personne.jobTitle, personne.organization, personne.country]
        .filter(Boolean)
        .join(", ");
      const nom = `${personne.firstName} ${personne.lastName}`.trim();
      return `${libelleRole(lien.role, langue)} — ${nom}${details ? ` (${details})` : ""}`;
    });

  const texte = lignes(
    [type, session.theme, quand, salle].filter(Boolean).join(" · "),
    dit(langue, {
      fr: session.descriptionFr,
      en: session.descriptionEn,
      pt: session.descriptionPt,
    }),
    // Les objectifs ne sont saisis qu'en une langue : repris tels quels, comme
    // la fiche publique les affiche, plutôt que tus faute de traduction.
    session.objectives
      ? `${selon(langue, { fr: "Objectifs", en: "Objectives", pt: "Objetivos" })} : ${session.objectives}`
      : "",
    intervenants.length > 0
      ? `${selon(langue, { fr: "Intervenants", en: "Speakers", pt: "Oradores" })} : ${intervenants.join(" ; ")}`
      : "",
  );

  return {
    id: `session:${session.id}:${langue}`,
    type: "session",
    langue,
    url: `/programme/${session.slug}`,
    titre,
    resume: [type, quand, salle].filter(Boolean).join(" · "),
    texte,
    donnees: sansVides({
      numero: session.number,
      type: session.type,
      theme: session.theme,
      jour: jourIso(session.day),
      debut: heure(session.startTime),
      fin: heure(session.endTime),
      salle: session.room?.name ?? null,
      direct: session.liveStreamUrl,
      // Termes de référence : public dès que la séance est publiée.
      tdr: session.tdrPath ? `/api/v1/sessions/${session.id}/tdr` : null,
    }),
    maj: iso(session.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Intervenants
// ---------------------------------------------------------------------------

export interface LigneIntervenant {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  organization: string | null;
  country: string | null;
  bioFr: string | null;
  bioEn: string | null;
  bioPt: string | null;
  updatedAt: Date;
  sessions: {
    role: string;
    session: { titleFr: string; titleEn: string; titlePt: string | null; theme: string | null };
  }[];
}

/**
 * Un intervenant publié.
 *
 * L'adresse porte l'ancre de sa carte : il n'existe pas de page par
 * intervenant, l'annuaire les présente tous et `#intervenant-<id>` ouvre la
 * bonne fiche, retournée sur sa biographie.
 */
export function documentIntervenant(personne: LigneIntervenant, langue: Langue): DocumentCorpus {
  const nom = `${personne.firstName} ${personne.lastName}`.trim();
  const fonction = [personne.jobTitle, personne.organization, personne.country]
    .filter(Boolean)
    .join(", ");

  const seances = personne.sessions.map((lien) => {
    const titre = dit(langue, {
      fr: lien.session.titleFr,
      en: lien.session.titleEn,
      pt: lien.session.titlePt,
    });
    return `${titre} (${libelleRole(lien.role, langue)})`;
  });

  return {
    id: `intervenant:${personne.id}:${langue}`,
    type: "intervenant",
    langue,
    url: `/intervenants#intervenant-${personne.id}`,
    titre: nom,
    resume: fonction,
    texte: lignes(
      fonction,
      dit(langue, { fr: personne.bioFr, en: personne.bioEn, pt: personne.bioPt }),
      seances.length > 0
        ? `${selon(langue, { fr: "Intervient dans", en: "Takes part in", pt: "Participa em" })} : ${seances.join(" ; ")}`
        : "",
    ),
    donnees: sansVides({
      fonction: personne.jobTitle,
      organisation: personne.organization,
      pays: personne.country,
    }),
    maj: iso(personne.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Actualités et newsletters
// ---------------------------------------------------------------------------

export interface LigneArticle {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  titlePt: string | null;
  excerptFr: string | null;
  excerptEn: string | null;
  excerptPt: string | null;
  bodyFr: string;
  bodyEn: string;
  bodyPt: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

export function documentActualite(post: LigneArticle, langue: Langue): DocumentCorpus {
  return {
    id: `actualite:${post.id}:${langue}`,
    type: "actualite",
    langue,
    url: `/actualites/${post.slug}`,
    titre: dit(langue, { fr: post.titleFr, en: post.titleEn, pt: post.titlePt }),
    resume: brut(langue, { fr: post.excerptFr, en: post.excerptEn, pt: post.excerptPt }),
    texte: brut(langue, { fr: post.bodyFr, en: post.bodyEn, pt: post.bodyPt }),
    donnees: sansVides({ publie: post.publishedAt ? jourIso(post.publishedAt) : null }),
    maj: iso(post.updatedAt),
  };
}

export function documentNewsletter(
  lettre: LigneArticle & { filePath?: string | null },
  langue: Langue,
): DocumentCorpus {
  // Avec un fichier de synthèse, l'ancien corps n'est plus affiché
  // (26 novembre 2026) : le corpus ne doit pas en citer ce que la page tait.
  const corps = lettre.filePath
    ? { fr: "", en: "", pt: null }
    : { fr: lettre.bodyFr, en: lettre.bodyEn, pt: lettre.bodyPt };
  return {
    id: `newsletter:${lettre.id}:${langue}`,
    type: "newsletter",
    langue,
    url: `/newsletters/${lettre.slug}`,
    titre: dit(langue, { fr: lettre.titleFr, en: lettre.titleEn, pt: lettre.titlePt }),
    resume: brut(langue, {
      fr: lettre.excerptFr,
      en: lettre.excerptEn,
      pt: lettre.excerptPt,
    }),
    texte: brut(langue, corps),
    donnees: sansVides({ publie: lettre.publishedAt ? jourIso(lettre.publishedAt) : null }),
    maj: iso(lettre.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Contenus éditoriaux : blocs, sections, rubriques pratiques
// ---------------------------------------------------------------------------

export interface LigneBloc {
  key: string;
  valueFr: unknown;
  valueEn: unknown;
  valuePt: unknown;
  updatedAt: Date;
}

/**
 * Où mène un bloc éditorial.
 *
 * Les six rubriques pratiques ne sont pas ici : leurs blocs sont assemblés par
 * `documentRubrique`, qui réunit l'encart et le texte long d'une même page
 * plutôt que de livrer deux moitiés indexées séparément.
 */
const URL_DES_BLOCS: Record<string, string> = {
  "home.hero.title": "/",
  "home.hero.lead": "/",
  "home.objectives.intro": "/",
  "about.body": "/#a-propos",
  "legal.privacy": "/confidentialite",
  "legal.terms": "/mentions-legales",
};

/**
 * Blocs qui n'alimentent que la **composition d'origine** de l'accueil
 * (`modules/sections/defaut.ts`).
 *
 * Dès que le comité a rangé des sections en BackOffice, la page d'accueil est
 * construite à partir d'elles et ces blocs ne sont plus affichés nulle part.
 * Les indexer alors reviendrait à répondre avec un texte qui n'est sur aucune
 * page — exactement ce qu'un assistant ne doit pas faire, même quand le texte
 * est juste. `service.ts` ne les livre donc qu'en l'absence de section visible.
 */
export const CLES_ACCUEIL_PAR_DEFAUT = new Set([
  "home.hero.title",
  "home.hero.lead",
  "home.objectives.intro",
  "about.body",
]);

/** Clés des blocs portés par les rubriques pratiques, assemblées ailleurs. */
export const CLES_DES_RUBRIQUES = new Set(
  RUBRIQUES.flatMap((rubrique) => [rubrique.cle, rubrique.cleDetail]).filter(
    (cle): cle is string => typeof cle === "string",
  ),
);

export function documentBloc(bloc: LigneBloc, langue: Langue): DocumentCorpus | null {
  const url = URL_DES_BLOCS[bloc.key];
  if (!url) return null;

  const zone = zoneEditoriale(bloc.key);
  const valeurs = {
    fr: typeof bloc.valueFr === "string" ? bloc.valueFr : null,
    en: typeof bloc.valueEn === "string" ? bloc.valueEn : null,
    pt: typeof bloc.valuePt === "string" ? bloc.valuePt : null,
  };
  // Un bloc simple (un titre) est du texte brut ; un bloc riche est un document
  // structuré, livré aplati. `zoneEditoriale` le dit, plutôt que de le deviner.
  const texte = zone?.riche === false ? dit(langue, valeurs) : brut(langue, valeurs);
  if (!texte) return null;

  return {
    id: `bloc:${bloc.key}:${langue}`,
    type: "bloc",
    langue,
    url,
    titre: zone?.label ?? bloc.key,
    resume: "",
    texte,
    maj: iso(bloc.updatedAt),
  };
}

/**
 * Une rubrique pratique : son encart et, s'il existe, son texte long.
 *
 * Hébergement et Contacts n'ont pas de texte long — leur détail est une liste
 * d'hôtels ou de contacts, livrée par les documents correspondants.
 */
export function documentRubrique(
  rubrique: Rubrique,
  blocs: Map<string, LigneBloc>,
  langue: Langue,
): DocumentCorpus | null {
  const encart = blocs.get(rubrique.cle);
  const detail = rubrique.cleDetail ? blocs.get(rubrique.cleDetail) : undefined;
  if (!encart && !detail) return null;

  const valeursDe = (bloc: LigneBloc | undefined) => ({
    fr: typeof bloc?.valueFr === "string" ? bloc.valueFr : null,
    en: typeof bloc?.valueEn === "string" ? bloc.valueEn : null,
    pt: typeof bloc?.valuePt === "string" ? bloc.valuePt : null,
  });

  const resume = brut(langue, valeursDe(encart));
  const corps = brut(langue, valeursDe(detail));
  if (!resume && !corps) return null;

  const maj = [encart?.updatedAt, detail?.updatedAt]
    .filter((date): date is Date => date instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    id: `rubrique:${rubrique.segment}:${langue}`,
    type: "rubrique",
    langue,
    url: `/infos-pratiques/${rubrique.segment}`,
    titre: libelleRubrique(rubrique, langue),
    resume,
    texte: lignes(resume, corps),
    maj: iso(maj ?? new Date(0)),
  };
}

export interface LigneSection {
  id: string;
  page: string;
  type: string;
  contentFr: unknown;
  contentEn: unknown;
  contentPt: unknown;
  settings: unknown;
  updatedAt: Date;
}

function champTexte(contenu: unknown, cle: string): string | null {
  if (contenu === null || typeof contenu !== "object") return null;
  const valeur = (contenu as Record<string, unknown>)[cle];
  return typeof valeur === "string" ? valeur : null;
}

/**
 * Une section composée de la page d'accueil.
 *
 * Les champs à lire, et lesquels sont mis en forme, viennent du catalogue des
 * types de sections — la même déclaration que celle qui construit le formulaire
 * du BackOffice. Une section d'un type inconnu est ignorée : le catalogue est
 * fermé, et une entrée absente signale un déploiement en retard, pas un contenu
 * à publier au hasard.
 */
export function documentSection(
  section: LigneSection,
  langue: Langue,
  chemin = "/",
): DocumentCorpus | null {
  const type = typeSection(section.type);
  if (!type) return null;

  const morceaux: string[] = [];
  let titre = "";

  for (const champ of type.champs) {
    const valeurs = {
      fr: champTexte(section.contentFr, champ.cle),
      en: champTexte(section.contentEn, champ.cle),
      pt: champTexte(section.contentPt, champ.cle),
    };
    const texte = champ.type === "riche" ? brut(langue, valeurs) : dit(langue, valeurs);
    if (!texte) continue;
    // Le texte alternatif d'une illustration décrit une image ; il n'est pas du
    // contenu, et indexé il ferait remonter une section sur la description de
    // son fond.
    if (champ.cle === "imageAlt") continue;
    if (!titre && champ.cle === "titre") titre = texte;
    morceaux.push(texte);
  }

  if (morceaux.length === 0) return null;

  // L'ancre, quand la section en porte une, mène droit à elle : c'est l'adresse
  // que le visiteur doit recevoir, pas le haut d'une page de huit sections.
  const ancre = champTexte(section.settings, "ancre");

  return {
    id: `section:${section.id}:${langue}`,
    type: "section",
    langue,
    url: ancre ? `${chemin}#${ancre}` : chemin,
    titre: titre || type.label,
    resume: "",
    texte: morceaux.join("\n\n"),
    maj: iso(section.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Hébergement et contacts
// ---------------------------------------------------------------------------

export interface LigneHotel {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  district: string | null;
  distanceKm: { toString(): string } | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  mapUrl: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  descriptionPt: string | null;
  amenities: unknown;
  bookingCode: string | null;
  bookingUrl: string | null;
  updatedAt: Date;
  rates: {
    roomType: string;
    price: number | null;
    currency: string;
    conditions: string | null;
  }[];
}

/**
 * Un hôtel partenaire, tarifs compris.
 *
 * Les prix et la distance passent dans `donnees` autant que dans le texte : un
 * participant compare, et un assistant qui reformule « environ 5 km » là où la
 * fiche dit 3,2 lui fait rater sa navette. Le code de réservation négocié,
 * lui, reste dehors : il est envoyé après confirmation, et n'a pas à sortir
 * d'un index consultable par n'importe quel visiteur.
 */
export function documentHotel(hotel: LigneHotel, langue: Langue): DocumentCorpus {
  const prestations = Array.isArray(hotel.amenities)
    ? hotel.amenities.filter((item): item is string => typeof item === "string")
    : [];

  const tarifs = hotel.rates.map((tarif) => {
    const prix =
      tarif.price === null ? "—" : `${tarif.price.toLocaleString("fr-FR")} ${tarif.currency}`;
    return `${tarif.roomType} : ${prix}${tarif.conditions ? ` (${tarif.conditions})` : ""}`;
  });

  const distance = hotel.distanceKm ? Number(hotel.distanceKm.toString()) : null;

  return {
    id: `hotel:${hotel.id}:${langue}`,
    type: "hotel",
    langue,
    url: "/infos-pratiques/hebergement",
    titre: hotel.name,
    resume: [hotel.category, hotel.district].filter(Boolean).join(" · "),
    texte: lignes(
      [hotel.category, hotel.district, hotel.address].filter(Boolean).join(" · "),
      dit(langue, {
        fr: hotel.descriptionFr,
        en: hotel.descriptionEn,
        pt: hotel.descriptionPt,
      }),
      distance !== null
        ? `${selon(langue, { fr: "Distance du lieu du Forum", en: "Distance from the venue", pt: "Distância do local do Fórum" })} : ${distance} km`
        : "",
      prestations.length > 0
        ? `${selon(langue, { fr: "Prestations", en: "Facilities", pt: "Serviços" })} : ${prestations.join(", ")}`
        : "",
      tarifs.length > 0
        ? `${selon(langue, { fr: "Tarifs", en: "Rates", pt: "Tarifas" })} : ${tarifs.join(" ; ")}`
        : "",
    ),
    donnees: sansVides({
      categorie: hotel.category,
      quartier: hotel.district,
      adresse: hotel.address,
      distanceKm: distance,
      telephone: hotel.phone,
      courriel: hotel.email,
      site: hotel.website,
      carte: hotel.mapUrl,
      reservation: hotel.bookingUrl,
    }),
    maj: iso(hotel.updatedAt),
  };
}

export interface LigneContact {
  id: string;
  labelFr: string;
  labelEn: string | null;
  labelPt: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  updatedAt: Date;
}

/**
 * Les contacts du comité, en un seul document.
 *
 * Un document par contact aurait répondu « Logistique » à qui demande « qui
 * appelle-t-on » ; la liste entière répond à la question posée, et l'assistant
 * y choisit la bonne ligne.
 */
export function documentContacts(contacts: LigneContact[], langue: Langue): DocumentCorpus | null {
  if (contacts.length === 0) return null;

  const lignesContacts = contacts.map((contact) => {
    const objet = dit(langue, {
      fr: contact.labelFr,
      en: contact.labelEn,
      pt: contact.labelPt,
    });
    const coordonnees = [contact.name, contact.email, contact.phone].filter(Boolean).join(" · ");
    return `${objet} : ${coordonnees}`;
  });

  const maj = contacts
    .map((contact) => contact.updatedAt)
    .sort((a, b) => b.getTime() - a.getTime())[0]!;

  return {
    id: `contact:comite:${langue}`,
    type: "contact",
    langue,
    url: "/infos-pratiques/contacts",
    titre: selon(langue, {
      fr: "Contacts du comité d'organisation",
      en: "Organising committee contacts",
      pt: "Contactos do comité organizador",
    }),
    resume: "",
    texte: lignesContacts.join("\n"),
    maj: iso(maj),
  };
}

// ---------------------------------------------------------------------------
// Partenaires, médiathèque, contributions
// ---------------------------------------------------------------------------

export interface LignePartenaire {
  id: string;
  name: string;
  descriptionFr: string | null;
  descriptionEn: string | null;
  descriptionPt: string | null;
  website: string | null;
  standNumber: string | null;
  updatedAt: Date;
  level: { name: string } | null;
}

export function documentPartenaire(sponsor: LignePartenaire, langue: Langue): DocumentCorpus {
  return {
    id: `partenaire:${sponsor.id}:${langue}`,
    type: "partenaire",
    langue,
    url: "/sponsors",
    titre: sponsor.name,
    resume: sponsor.level?.name ?? "",
    texte: lignes(
      sponsor.level?.name ?? "",
      dit(langue, {
        fr: sponsor.descriptionFr,
        en: sponsor.descriptionEn,
        pt: sponsor.descriptionPt,
      }),
      sponsor.standNumber
        ? `${selon(langue, { fr: "Stand", en: "Stand", pt: "Stand" })} ${sponsor.standNumber}`
        : "",
    ),
    donnees: sansVides({
      niveau: sponsor.level?.name ?? null,
      site: sponsor.website,
      stand: sponsor.standNumber,
    }),
    maj: iso(sponsor.updatedAt),
  };
}

export interface LigneAlbum {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  titlePt: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  descriptionPt: string | null;
  eventDate: Date | null;
  updatedAt: Date;
  _count?: { items: number };
}

export function documentAlbum(album: LigneAlbum, langue: Langue): DocumentCorpus {
  return {
    id: `album:${album.id}:${langue}`,
    type: "album",
    langue,
    url: `/mediatheque/${album.slug}`,
    titre: dit(langue, { fr: album.titleFr, en: album.titleEn, pt: album.titlePt }),
    resume: "",
    texte: dit(langue, {
      fr: album.descriptionFr,
      en: album.descriptionEn,
      pt: album.descriptionPt,
    }),
    donnees: sansVides({
      date: album.eventDate ? jourIso(album.eventDate) : null,
      elements: album._count?.items ?? null,
    }),
    maj: iso(album.updatedAt),
  };
}

export interface LigneCapitalisation {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  titlePt: string | null;
  day: Date;
  updatedAt: Date;
  contributions: { id: string; type: string; title: string }[];
}

/**
 * Les contributions publiées d'une séance.
 *
 * L'adresse est celle de la séance et non celle de la page « Contributions » :
 * c'est là que les documents sont téléchargeables, et renvoyer vers la liste
 * obligerait le visiteur à y rechercher la séance qu'il vient de nommer.
 */
export function documentContributions(
  seance: LigneCapitalisation,
  langue: Langue,
): DocumentCorpus | null {
  if (seance.contributions.length === 0) return null;

  const titre = dit(langue, {
    fr: seance.titleFr,
    en: seance.titleEn,
    pt: seance.titlePt,
  });

  return {
    id: `contribution:${seance.id}:${langue}`,
    type: "contribution",
    langue,
    url: `/programme/${seance.slug}`,
    titre: `${selon(langue, { fr: "Contributions", en: "Contributions", pt: "Contribuições" })} — ${titre}`,
    resume: "",
    texte: seance.contributions.map((contribution) => contribution.title).join("\n"),
    donnees: sansVides({
      seance: titre,
      jour: jourIso(seance.day),
      nombre: seance.contributions.length,
    }),
    maj: iso(seance.updatedAt),
  };
}
