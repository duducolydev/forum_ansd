import type { Edition, PageSection } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getHomeStats } from "@/lib/stats";
import { listPosts } from "@/modules/content/service";
import { besoinsDesSections } from "./service";

/**
 * Données des sections d'une page, chargées **en une passe**.
 *
 * Chaque section pourrait interroger la base elle-même ; une page de huit
 * sections ferait alors huit allers-retours, dont plusieurs identiques. On
 * calcule donc l'union de ce que réclament les sections visibles, on charge une
 * fois, et chaque rendu se sert.
 */

/** Plafond de chargement, au-delà du maximum que le catalogue autorise à afficher. */
const PLAFOND = 12;

export interface DonneesSections {
  edition: Edition;
  stats?: Awaited<ReturnType<typeof getHomeStats>>;
  actualites?: Awaited<ReturnType<typeof listPosts>>;
  sponsors?: {
    id: string;
    name: string;
    logoMaxWidth: number | null;
    sponsors: { id: string; name: string; logoPath: string | null; website: string | null }[];
  }[];
  intervenants?: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    organization: string | null;
    photoPath: string | null;
  }[];
  sessions?: {
    id: string;
    slug: string;
    titleFr: string;
    titleEn: string;
    startTime: Date;
  }[];
}

export async function chargerDonnees(
  edition: Edition,
  sections: PageSection[],
): Promise<DonneesSections> {
  const besoins = besoinsDesSections(sections);
  const donnees: DonneesSections = { edition };

  const travaux: Promise<void>[] = [];

  if (besoins.has("stats")) {
    travaux.push(
      getHomeStats(edition.id).then((stats) => {
        donnees.stats = stats;
      }),
    );
  }

  if (besoins.has("actualites")) {
    travaux.push(
      listPosts(edition.id, { onlyPublished: true }).then((posts) => {
        donnees.actualites = posts.slice(0, PLAFOND);
      }),
    );
  }

  if (besoins.has("sponsors")) {
    travaux.push(
      prisma.sponsorLevel
        .findMany({
          where: { editionId: edition.id },
          orderBy: { sortOrder: "asc" },
          include: {
            sponsors: {
              where: { isPublished: true, deletedAt: null },
              orderBy: { name: "asc" },
              // Projection explicite : les contacts internes (§5.9) ne doivent
              // atteindre aucune page publique.
              select: { id: true, name: true, logoPath: true, website: true },
            },
          },
        })
        .then((niveaux) => {
          donnees.sponsors = niveaux
            .filter((niveau) => niveau.sponsors.length > 0)
            .map((niveau) => ({
              id: niveau.id,
              name: niveau.name,
              logoMaxWidth: niveau.logoMaxWidth,
              sponsors: niveau.sponsors,
            }));
        }),
    );
  }

  if (besoins.has("intervenants")) {
    travaux.push(
      prisma.speaker
        .findMany({
          where: { editionId: edition.id, isPublished: true, deletedAt: null },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          take: PLAFOND,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            organization: true,
            photoPath: true,
          },
        })
        .then((speakers) => {
          donnees.intervenants = speakers;
        }),
    );
  }

  if (besoins.has("sessions")) {
    travaux.push(
      prisma.session
        .findMany({
          where: { editionId: edition.id, isPublished: true, deletedAt: null },
          orderBy: { startTime: "asc" },
          take: PLAFOND,
          select: { id: true, slug: true, titleFr: true, titleEn: true, startTime: true },
        })
        .then((sessions) => {
          donnees.sessions = sessions;
        }),
    );
  }

  await Promise.all(travaux);
  return donnees;
}
