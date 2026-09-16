import { unstable_cache } from "next/cache";
import { prisma } from "./db";

/** Chiffres clés de la page d'accueil (brief §5.1), mis en cache 5 minutes. */
export const getHomeStats = unstable_cache(
  async (editionId: string) => {
    const [confirmedParticipants, publishedSpeakers, publishedSessions, countries] =
      await Promise.all([
        prisma.participant.count({
          where: {
            editionId,
            deletedAt: null,
            status: { in: ["CONFIRMED", "BADGED", "CHECKED_IN"] },
          },
        }),
        prisma.speaker.count({ where: { editionId, isPublished: true, deletedAt: null } }),
        // Ajouté pour la section « chiffres clés » (§8.4) : le brief §5.1 la
        // demandait déjà, mais le compteur n'existait pas.
        prisma.session.count({ where: { editionId, isPublished: true, deletedAt: null } }),
        prisma.participant.findMany({
          where: {
            editionId,
            deletedAt: null,
            status: { in: ["CONFIRMED", "BADGED", "CHECKED_IN"] },
          },
          select: { country: true },
          distinct: ["country"],
        }),
      ]);

    const byCountry = await prisma.participant.groupBy({
      by: ["country"],
      where: { editionId, deletedAt: null, status: { in: ["CONFIRMED", "BADGED", "CHECKED_IN"] } },
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
      take: 6,
    });

    return {
      confirmedParticipants,
      publishedSpeakers,
      publishedSessions,
      countryCount: countries.length,
      topCountries: byCountry.map((row) => ({ country: row.country, count: row._count._all })),
    };
  },
  ["home-stats"],
  { revalidate: 300 },
);
