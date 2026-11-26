import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { LANGUES, type Langue } from "@/lib/langue";
import { RUBRIQUES } from "@/modules/hotels/rubriques";
import {
  CLES_ACCUEIL_PAR_DEFAUT,
  CLES_DES_RUBRIQUES,
  documentActualite,
  documentAlbum,
  documentBloc,
  documentContacts,
  documentContributions,
  documentHotel,
  documentIntervenant,
  documentNewsletter,
  documentPartenaire,
  documentRubrique,
  documentSection,
  documentSession,
  documentsReperes,
  type LigneBloc,
} from "./construire";
import type { Corpus, DocumentCorpus } from "./types";

/**
 * Lecture du corpus public (16 novembre 2026).
 *
 * Une passe, toutes les tables publiques, puis un document par contenu et par
 * langue demandée. Le filtrage de publication est posé **dans les `where`** et
 * non après coup : un brouillon ne doit pas même sortir de la base, pour qu'une
 * erreur de composition ultérieure ne puisse pas le laisser passer.
 *
 * Aucune table de personnes n'est lue ici, hormis `Speaker` restreinte aux
 * intervenants publiés : ni `Participant`, ni `Invitation`, ni `Badge`, ni
 * `ScanLog`, ni `SessionRegistration`, ni `User`. C'est la garantie que
 * l'export ne peut pas livrer de donnée personnelle, et elle tient à la liste
 * de requêtes ci-dessous — pas à un filtre qu'on pourrait oublier.
 */

export interface OptionsCorpus {
  /** Langues à produire. Les trois par défaut. */
  langues?: Langue[];
  /** Ne garder que les documents modifiés depuis cette date (réindexation partielle). */
  depuis?: Date;
}

export async function construireCorpus(options: OptionsCorpus = {}): Promise<Corpus> {
  const langues = options.langues?.length ? options.langues : [...LANGUES];
  const edition = await getActiveEdition();

  const [
    sessions,
    intervenants,
    actualites,
    newsletters,
    blocs,
    sections,
    hotels,
    contacts,
    partenaires,
    albums,
    capitalisees,
  ] = await Promise.all([
    prisma.session.findMany({
      where: { editionId: edition.id, isPublished: true, deletedAt: null },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        slug: true,
        number: true,
        type: true,
        titleFr: true,
        titleEn: true,
        titlePt: true,
        descriptionFr: true,
        descriptionEn: true,
        descriptionPt: true,
        objectives: true,
        theme: true,
        day: true,
        startTime: true,
        endTime: true,
        liveStreamUrl: true,
        tdrPath: true,
        updatedAt: true,
        room: { select: { name: true } },
        speakers: {
          orderBy: { sortOrder: "asc" },
          select: {
            role: true,
            speaker: {
              select: {
                firstName: true,
                lastName: true,
                jobTitle: true,
                organization: true,
                country: true,
                isPublished: true,
              },
            },
          },
        },
      },
    }),

    prisma.speaker.findMany({
      where: { editionId: edition.id, isPublished: true, deletedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        organization: true,
        country: true,
        bioFr: true,
        bioEn: true,
        bioPt: true,
        updatedAt: true,
        sessions: {
          // Les séances non publiées ne sont pas nommées : la carte publique de
          // l'intervenant ne les montre pas non plus.
          where: { session: { isPublished: true, deletedAt: null } },
          orderBy: { sortOrder: "asc" },
          select: {
            role: true,
            session: {
              select: { titleFr: true, titleEn: true, titlePt: true, theme: true },
            },
          },
        },
      },
    }),

    prisma.post.findMany({
      where: { editionId: edition.id, isPublished: true },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        slug: true,
        titleFr: true,
        titleEn: true,
        titlePt: true,
        excerptFr: true,
        excerptEn: true,
        excerptPt: true,
        bodyFr: true,
        bodyEn: true,
        bodyPt: true,
        publishedAt: true,
        updatedAt: true,
      },
    }),

    prisma.newsletter.findMany({
      where: { editionId: edition.id, isPublished: true },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        slug: true,
        titleFr: true,
        titleEn: true,
        titlePt: true,
        excerptFr: true,
        excerptEn: true,
        excerptPt: true,
        bodyFr: true,
        bodyEn: true,
        bodyPt: true,
        filePath: true,
        publishedAt: true,
        updatedAt: true,
      },
    }),

    prisma.contentBlock.findMany({
      where: { editionId: edition.id },
      select: { key: true, valueFr: true, valueEn: true, valuePt: true, updatedAt: true },
    }),

    prisma.pageSection.findMany({
      where: { editionId: edition.id, page: "accueil", isVisible: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        page: true,
        type: true,
        contentFr: true,
        contentEn: true,
        contentPt: true,
        settings: true,
        updatedAt: true,
      },
    }),

    prisma.hotel.findMany({
      where: { editionId: edition.id, isPublished: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        address: true,
        district: true,
        distanceKm: true,
        phone: true,
        email: true,
        website: true,
        mapUrl: true,
        descriptionFr: true,
        descriptionEn: true,
        descriptionPt: true,
        amenities: true,
        bookingCode: true,
        bookingUrl: true,
        updatedAt: true,
        rates: {
          orderBy: { sortOrder: "asc" },
          select: { roomType: true, price: true, currency: true, conditions: true },
        },
      },
    }),

    prisma.practicalContact.findMany({
      where: { editionId: edition.id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        labelFr: true,
        labelEn: true,
        labelPt: true,
        name: true,
        email: true,
        phone: true,
        updatedAt: true,
      },
    }),

    prisma.sponsor.findMany({
      where: { editionId: edition.id, isPublished: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        descriptionFr: true,
        descriptionEn: true,
        descriptionPt: true,
        website: true,
        standNumber: true,
        updatedAt: true,
        level: { select: { name: true } },
      },
    }),

    prisma.mediaAlbum.findMany({
      where: { editionId: edition.id, isPublished: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        titleFr: true,
        titleEn: true,
        titlePt: true,
        descriptionFr: true,
        descriptionEn: true,
        descriptionPt: true,
        eventDate: true,
        updatedAt: true,
        _count: { select: { items: { where: { isPublished: true } } } },
      },
    }),

    prisma.session.findMany({
      where: {
        editionId: edition.id,
        isPublished: true,
        deletedAt: null,
        contributions: { some: { isPublished: true } },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        slug: true,
        titleFr: true,
        titleEn: true,
        titlePt: true,
        day: true,
        updatedAt: true,
        contributions: {
          where: { isPublished: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, type: true, title: true },
        },
      },
    }),
  ]);

  const parCle = new Map<string, LigneBloc>(blocs.map((bloc) => [bloc.key, bloc]));

  /*
   * L'accueil est-il composé par le comité ? La page d'accueil pose la même
   * question (`app/(public)/page.tsx`) : avec des sections, elle les rend ;
   * sans, elle rend la composition d'origine, qui lit les blocs `home.*` et
   * `about.body`. Le corpus suit, pour ne jamais livrer un texte qui n'est
   * affiché nulle part.
   */
  const accueilCompose = sections.length > 0;

  const documents: DocumentCorpus[] = [];

  for (const langue of langues) {
    documents.push(...documentsReperes(langue));

    for (const section of sections) {
      const document = documentSection(section, langue, "/");
      if (document) documents.push(document);
    }

    for (const bloc of blocs) {
      // Les blocs des rubriques pratiques sont assemblés par rubrique, deux
      // moitiés en un document : les livrer aussi un à un doublerait l'index.
      if (CLES_DES_RUBRIQUES.has(bloc.key)) continue;
      if (accueilCompose && CLES_ACCUEIL_PAR_DEFAUT.has(bloc.key)) continue;
      const document = documentBloc(bloc, langue);
      if (document) documents.push(document);
    }

    for (const rubrique of RUBRIQUES) {
      const document = documentRubrique(rubrique, parCle, langue);
      if (document) documents.push(document);
    }

    for (const session of sessions) documents.push(documentSession(session, langue));
    for (const personne of intervenants) documents.push(documentIntervenant(personne, langue));
    for (const post of actualites) documents.push(documentActualite(post, langue));
    for (const lettre of newsletters) documents.push(documentNewsletter(lettre, langue));
    for (const hotel of hotels) documents.push(documentHotel(hotel, langue));
    for (const sponsor of partenaires) documents.push(documentPartenaire(sponsor, langue));
    for (const album of albums) documents.push(documentAlbum(album, langue));

    const contactsDuComite = documentContacts(contacts, langue);
    if (contactsDuComite) documents.push(contactsDuComite);

    for (const seance of capitalisees) {
      const document = documentContributions(seance, langue);
      if (document) documents.push(document);
    }
  }

  const retenus = options.depuis
    ? documents.filter((document) => new Date(document.maj) > options.depuis!)
    : documents;

  return {
    version: 1,
    base: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
    edition: {
      code: edition.code,
      titre: edition.title,
      theme: edition.theme,
      debut: edition.startDate.toISOString().slice(0, 10),
      fin: edition.endDate.toISOString().slice(0, 10),
      lieu: edition.venue,
      ville: edition.city,
    },
    genere: new Date().toISOString(),
    langues,
    nombre: retenus.length,
    documents: retenus,
  };
}
