import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Accès base de l'hébergement et des contacts pratiques (§29).
 *
 * Les lectures publiques et celles du BackOffice sont distinctes : la première
 * ne rend que les hôtels publiés et vivants, la seconde tout ce qui est en
 * préparation. Une seule fonction avec un drapeau aurait fini par être appelée
 * sans, et un tarif en cours de négociation se serait retrouvé en ligne.
 */

const TRI_HOTELS: Prisma.HotelOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { distanceKm: "asc" },
  { name: "asc" },
];

/** Hôtels visibles du public : publiés, non supprimés, tarifs compris. */
export async function listHotelsPublies(editionId: string) {
  return prisma.hotel.findMany({
    where: { editionId, isPublished: true, deletedAt: null },
    include: { rates: { orderBy: [{ sortOrder: "asc" }, { price: "asc" }] } },
    orderBy: TRI_HOTELS,
  });
}

/** Tous les hôtels, brouillons compris, pour le BackOffice. */
export async function listHotels(editionId: string) {
  return prisma.hotel.findMany({
    where: { editionId, deletedAt: null },
    include: { _count: { select: { rates: true } } },
    orderBy: TRI_HOTELS,
  });
}

export async function findHotelById(id: string) {
  return prisma.hotel.findFirst({
    where: { id, deletedAt: null },
    include: { rates: { orderBy: [{ sortOrder: "asc" }, { price: "asc" }] } },
  });
}

export async function createHotel(data: Prisma.HotelCreateInput) {
  return prisma.hotel.create({ data });
}

export async function updateHotel(id: string, data: Prisma.HotelUpdateInput) {
  return prisma.hotel.update({ where: { id }, data });
}

/**
 * Suppression **logique**.
 *
 * Un hôtel retiré a pu être communiqué à des participants qui ont déjà
 * réservé ; effacer la ligne effacerait aussi la trace de ce qu'on leur avait
 * annoncé. Le champ `deletedAt` suffit à le sortir de toutes les listes.
 */
export async function softDeleteHotel(id: string) {
  return prisma.hotel.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function createRate(data: Prisma.HotelRateCreateInput) {
  return prisma.hotelRate.create({ data });
}

export async function updateRate(id: string, data: Prisma.HotelRateUpdateInput) {
  return prisma.hotelRate.update({ where: { id }, data });
}

export async function deleteRate(id: string) {
  return prisma.hotelRate.delete({ where: { id } });
}

export async function findRateById(id: string) {
  return prisma.hotelRate.findUnique({ where: { id } });
}

// --- Contacts pratiques ----------------------------------------------------

export async function listContacts(editionId: string) {
  return prisma.practicalContact.findMany({
    where: { editionId },
    orderBy: [{ sortOrder: "asc" }, { labelFr: "asc" }],
  });
}

export async function findContactById(id: string) {
  return prisma.practicalContact.findUnique({ where: { id } });
}

export async function createContact(data: Prisma.PracticalContactCreateInput) {
  return prisma.practicalContact.create({ data });
}

export async function updateContact(id: string, data: Prisma.PracticalContactUpdateInput) {
  return prisma.practicalContact.update({ where: { id }, data });
}

export async function deleteContact(id: string) {
  return prisma.practicalContact.delete({ where: { id } });
}
