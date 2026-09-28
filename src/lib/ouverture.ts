import type { Edition } from "@prisma/client";
import { prisma } from "./db";

/**
 * Heure d'ouverture du Forum, cible des comptes à rebours (brief
 * « Constellation » §4.1) : le début de la première session publiée.
 *
 * L'édition ne porte qu'une date, à minuit ; la première session porte
 * l'heure réelle. Sans programme publié, on retombe sur le début de
 * l'édition. Jamais une date écrite en dur.
 */
export async function heureOuverture(edition: Pick<Edition, "id" | "startDate">): Promise<Date> {
  const premiere = await prisma.session.findFirst({
    where: { editionId: edition.id, isPublished: true, deletedAt: null },
    orderBy: { startTime: "asc" },
    select: { startTime: true },
  });
  return premiere?.startTime ?? edition.startDate;
}
