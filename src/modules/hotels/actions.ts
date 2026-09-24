"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";
import { parseHotelForm, parseHotelRateForm, parsePracticalContactForm } from "./schema";

export interface ActionState {
  error?: string;
}

/**
 * Points d'entrée de l'hébergement et des contacts pratiques (§29).
 *
 * Tous gardés par `hotels.manage`, le jeton du gestionnaire des hôtels. Il
 * n'ouvre rien d'autre : ni l'éditorial du site, ni les participants.
 */

async function requireSession(): Promise<Session & { user: NonNullable<Session["user"]> }> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  return session as Session & { user: NonNullable<Session["user"]> };
}

function actorFromSession(session: { user: { id: string } }) {
  return { type: "USER" as const, userId: session.user.id };
}

function firstFieldError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

/**
 * Les pages publiques et le BackOffice sont rafraîchis ensemble.
 *
 * La page de détail de l'hébergement lit la même donnée que la liste
 * d'administration : n'en revalider qu'une laisserait le visiteur devant un
 * tarif que le BackOffice affiche déjà corrigé.
 */
function rafraichir(hotelId?: string): void {
  revalidatePath("/admin/hotels");
  if (hotelId) revalidatePath(`/admin/hotels/${hotelId}`);
  revalidatePath("/infos-pratiques");
  revalidatePath("/infos-pratiques/hebergement");
  revalidatePath("/infos-pratiques/contacts");
}

export async function createHotelAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "hotels.manage")) return { error: "Permission refusée." };

    const edition = await getActiveEdition();
    await service.createHotel(edition.id, parseHotelForm(formData), actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  rafraichir();
  return {};
}

export async function updateHotelAction(
  hotelId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "hotels.manage")) return { error: "Permission refusée." };

    await service.updateHotel(hotelId, parseHotelForm(formData), actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  rafraichir(hotelId);
  return {};
}

export async function deleteHotelAction(
  hotelId: string,
  _prevState: ActionState,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "hotels.manage")) return { error: "Permission refusée." };

    await service.deleteHotel(hotelId, actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  rafraichir();
  return {};
}

export async function createRateAction(
  hotelId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "hotels.manage")) return { error: "Permission refusée." };

    await service.createRate(hotelId, parseHotelRateForm(formData), actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  rafraichir(hotelId);
  return {};
}

export async function deleteRateAction(
  rateId: string,
  hotelId: string,
  _prevState: ActionState,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "hotels.manage")) return { error: "Permission refusée." };

    await service.deleteRate(rateId, actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  rafraichir(hotelId);
  return {};
}

// --- Contacts --------------------------------------------------------------

export async function createContactAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "hotels.manage")) return { error: "Permission refusée." };

    const edition = await getActiveEdition();
    await service.createContact(
      edition.id,
      parsePracticalContactForm(formData),
      actorFromSession(session),
    );
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  revalidatePath("/admin/contacts-pratiques");
  revalidatePath("/infos-pratiques/contacts");
  return {};
}

export async function updateContactAction(
  contactId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "hotels.manage")) return { error: "Permission refusée." };

    await service.updateContact(
      contactId,
      parsePracticalContactForm(formData),
      actorFromSession(session),
    );
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  revalidatePath("/admin/contacts-pratiques");
  revalidatePath("/infos-pratiques/contacts");
  return {};
}

export async function deleteContactAction(
  contactId: string,
  _prevState: ActionState,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "hotels.manage")) return { error: "Permission refusée." };

    await service.deleteContact(contactId, actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  revalidatePath("/admin/contacts-pratiques");
  revalidatePath("/infos-pratiques/contacts");
  return {};
}
