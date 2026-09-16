"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";
import * as images from "./images";
import { contentBlockInputSchema, postInputSchema, type PostInput } from "./schema";

export interface ActionState {
  error?: string;
}

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  return session;
}

function firstFieldError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

export async function saveContentBlockAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "content.write")) return { error: "Permission refusée." };

    const input = contentBlockInputSchema.parse({
      key: formData.get("key"),
      valueFr: formData.get("valueFr"),
      valueEn: formData.get("valueEn") ?? undefined,
    });

    const edition = await getActiveEdition();
    await service.saveContentBlock(edition.id, input, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  revalidatePath("/admin/contenus");
  revalidatePath("/");
  // « À propos » vit désormais dans une section de l'accueil (§12).
  revalidatePath("/");
  revalidatePath("/infos-pratiques");
  return {};
}

function parsePostForm(formData: FormData): PostInput {
  return postInputSchema.parse({
    slug: formData.get("slug"),
    titleFr: formData.get("titleFr"),
    titleEn: formData.get("titleEn") ?? undefined,
    excerptFr: formData.get("excerptFr") ?? undefined,
    excerptEn: formData.get("excerptEn") ?? undefined,
    bodyFr: formData.get("bodyFr"),
    bodyEn: formData.get("bodyEn") ?? undefined,
    isPublished: formData.get("isPublished") === "on",
  });
}

export async function createPostAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "content.write")) return { error: "Permission refusée." };

    const input = parsePostForm(formData);
    const edition = await getActiveEdition();
    await service.createPost(edition.id, input, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  revalidatePath("/admin/contenus/actualites");
  revalidatePath("/actualites");
  revalidatePath("/");
  return {};
}

/** Rafraîchit les surfaces où un article apparaît : liste, fiche et accueil. */
function rafraichirArticle(slug?: string): void {
  revalidatePath("/admin/contenus/actualites");
  revalidatePath("/actualites");
  if (slug) revalidatePath(`/actualites/${slug}`);
  revalidatePath("/");
}

export async function televerserCouvertureAction(
  postId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "content.write")) return { error: "Permission refusée." };

    const fichier = formData.get("image");
    if (!(fichier instanceof File)) return { error: "Aucun fichier reçu." };
    await images.enregistrerCouverture(postId, fichier, {
      type: "USER",
      userId: session.user.id,
    });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  rafraichirArticle();
  revalidatePath(`/admin/contenus/actualites/${postId}`);
  return {};
}

export async function retirerCouvertureAction(postId: string): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "content.write")) return { error: "Permission refusée." };
    await images.retirerCouverture(postId, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  rafraichirArticle();
  revalidatePath(`/admin/contenus/actualites/${postId}`);
  return {};
}

export async function ajouterImageGalerieAction(
  postId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "content.write")) return { error: "Permission refusée." };

    const fichier = formData.get("image");
    if (!(fichier instanceof File)) return { error: "Aucun fichier reçu." };
    await images.ajouterImageGalerie(
      postId,
      fichier,
      {
        fr: String(formData.get("captionFr") ?? "").trim(),
        en: String(formData.get("captionEn") ?? "").trim(),
      },
      { type: "USER", userId: session.user.id },
    );
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  rafraichirArticle();
  revalidatePath(`/admin/contenus/actualites/${postId}`);
  return {};
}

export async function retirerImageGalerieAction(
  postId: string,
  rang: number,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "content.write")) return { error: "Permission refusée." };
    await images.retirerImageGalerie(postId, rang, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  rafraichirArticle();
  revalidatePath(`/admin/contenus/actualites/${postId}`);
  return {};
}

export async function updatePostAction(
  postId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "content.write")) return { error: "Permission refusée." };

    const input = parsePostForm(formData);
    await service.updatePost(postId, input, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  revalidatePath("/admin/contenus/actualites");
  revalidatePath("/actualites");
  revalidatePath("/");
  return {};
}
