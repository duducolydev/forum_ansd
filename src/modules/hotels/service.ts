import { audit } from "@/lib/audit";
import type { Actor } from "@/modules/participants/service";
import * as repo from "./repository";
import type { HotelInput, HotelRateInput, PracticalContactInput } from "./schema";

/**
 * Hébergement et contacts des « Infos pratiques » (§29).
 *
 * Toutes les écritures passent par le journal d'audit : ce sont des tarifs
 * négociés et des coordonnées publiées, et savoir qui a changé un prix la
 * veille du Forum n'est pas une curiosité.
 */

export const listHotelsPublies = repo.listHotelsPublies;
export const listHotels = repo.listHotels;
export const findHotelById = repo.findHotelById;
export const listContacts = repo.listContacts;
export const findContactById = repo.findContactById;

function champsHotel(input: HotelInput) {
  return {
    name: input.name,
    category: input.category || null,
    address: input.address || null,
    district: input.district || null,
    distanceKm: input.distanceKm ?? null,
    phone: input.phone || null,
    email: input.email || null,
    website: input.website || null,
    mapUrl: input.mapUrl || null,
    descriptionFr: input.descriptionFr || null,
    descriptionEn: input.descriptionEn || null,
    amenities: input.amenities,
    bookingCode: input.bookingCode || null,
    bookingUrl: input.bookingUrl || null,
    isPublished: input.isPublished,
    sortOrder: input.sortOrder,
  };
}

export async function createHotel(editionId: string, input: HotelInput, actor: Actor) {
  const hotel = await repo.createHotel({
    edition: { connect: { id: editionId } },
    ...champsHotel(input),
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "hotel.create",
    entity: "Hotel",
    entityId: hotel.id,
    after: { name: hotel.name, isPublished: hotel.isPublished },
  });

  return hotel;
}

export async function updateHotel(id: string, input: HotelInput, actor: Actor) {
  const avant = await repo.findHotelById(id);
  const hotel = await repo.updateHotel(id, champsHotel(input));

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "hotel.update",
    entity: "Hotel",
    entityId: id,
    before: avant ? { name: avant.name, isPublished: avant.isPublished } : undefined,
    after: { name: hotel.name, isPublished: hotel.isPublished },
  });

  return hotel;
}

export async function deleteHotel(id: string, actor: Actor) {
  const avant = await repo.findHotelById(id);
  await repo.softDeleteHotel(id);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "hotel.delete",
    entity: "Hotel",
    entityId: id,
    before: avant ? { name: avant.name } : undefined,
  });
}

// --- Tarifs ----------------------------------------------------------------

export async function createRate(hotelId: string, input: HotelRateInput, actor: Actor) {
  const rate = await repo.createRate({
    hotel: { connect: { id: hotelId } },
    roomType: input.roomType,
    price: input.price ?? null,
    currency: input.currency,
    conditions: input.conditions || null,
    sortOrder: input.sortOrder,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "hotel.rate_create",
    entity: "HotelRate",
    entityId: rate.id,
    after: { hotelId, roomType: rate.roomType, price: rate.price },
  });

  return rate;
}

export async function deleteRate(id: string, actor: Actor) {
  const avant = await repo.findRateById(id);
  await repo.deleteRate(id);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "hotel.rate_delete",
    entity: "HotelRate",
    entityId: id,
    before: avant ? { roomType: avant.roomType, price: avant.price } : undefined,
  });
}

// --- Contacts --------------------------------------------------------------

function champsContact(input: PracticalContactInput) {
  return {
    labelFr: input.labelFr,
    labelEn: input.labelEn || null,
    name: input.name || null,
    email: input.email || null,
    phone: input.phone || null,
    sortOrder: input.sortOrder,
  };
}

export async function createContact(editionId: string, input: PracticalContactInput, actor: Actor) {
  const contact = await repo.createContact({
    edition: { connect: { id: editionId } },
    ...champsContact(input),
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "practical_contact.create",
    entity: "PracticalContact",
    entityId: contact.id,
    after: { labelFr: contact.labelFr },
  });

  return contact;
}

export async function updateContact(id: string, input: PracticalContactInput, actor: Actor) {
  const contact = await repo.updateContact(id, champsContact(input));

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "practical_contact.update",
    entity: "PracticalContact",
    entityId: id,
    after: { labelFr: contact.labelFr },
  });

  return contact;
}

export async function deleteContact(id: string, actor: Actor) {
  const avant = await repo.findContactById(id);
  await repo.deleteContact(id);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "practical_contact.delete",
    entity: "PracticalContact",
    entityId: id,
    before: avant ? { labelFr: avant.labelFr } : undefined,
  });
}

/** Prestations d'un hôtel, telles qu'elles sont stockées en `Json`. */
export function prestations(amenities: unknown): string[] {
  return Array.isArray(amenities) ? amenities.map(String).filter(Boolean) : [];
}
