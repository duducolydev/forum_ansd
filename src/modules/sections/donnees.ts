import type { Edition, PageSection } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getHomeStats } from "@/lib/stats";
import { listPosts } from "@/modules/content/service";
import { listerSponsorsPublies } from "@/modules/sponsors/service";
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
  /** Partenaires publiés, dans l'ordre décidé par le comité — le même que sur leur page. */
  sponsors?: Awaited<ReturnType<typeof listerSponsorsPublies>>;
  intervenants?: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    organization: string | null;
    photoPath: string | null;
    /** Thèmes des sessions publiées où il intervient — ceux du filtre de la section. */
    themes: string[];
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
    /*
     * Liste à plat, dans l'ordre de la page Partenaires : le carrousel la suit
     * telle quelle, et la grille la regroupe par niveau au rendu. La projection
     * du service écarte déjà les contacts internes (§5.9).
     */
    travaux.push(
      listerSponsorsPublies(edition.id).then((sponsors) => {
        donnees.sponsors = sponsors;
      }),
    );
  }

  if (besoins.has("intervenants")) {
    /*
     * Tous les intervenants publiés, et non les douze premiers : la section se
     * filtre par thème, et le filtre doit chercher dans la liste entière avant
     * d'en afficher le nombre réglé. Leurs thèmes viennent des sessions
     * publiées, comme sur la page Intervenants (§31).
     */
    travaux.push(
      prisma.speaker
        .findMany({
          where: { editionId: edition.id, isPublished: true, deletedAt: null },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            organization: true,
            photoPath: true,
            sessions: {
              where: { session: { isPublished: true, deletedAt: null } },
              select: { session: { select: { theme: true } } },
            },
          },
        })
        .then((speakers) => {
          donnees.intervenants = speakers.map(({ sessions, ...speaker }) => ({
            ...speaker,
            themes: [
              ...new Set(
                sessions
                  .map((lien) => lien.session.theme)
                  .filter((theme): theme is string => Boolean(theme)),
              ),
            ].sort((a, b) => a.localeCompare(b, "fr")),
          }));
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
