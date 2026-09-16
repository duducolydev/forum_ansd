"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import type { Permission } from "@/lib/permissions";
import { getActiveEdition } from "@/lib/edition";
import { enqueueBulk } from "./jobs";
import { previewBulk, updateTemplate } from "./service";
import { bulkSendSchema, templateSchema } from "./schema";

export interface NotificationActionState {
  error?: string;
  success?: string;
  /** Résultat d'une prévisualisation d'envoi groupé, avant confirmation. */
  preview?: {
    total: number;
    sample: string[];
    templateKey: string;
    /** Filtre exact qui a produit ce décompte, rejoué tel quel à la confirmation. */
    filter: { status: string; categoryId: string; country: string };
  };
}

async function requireStaff(permission: Permission) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, permission)) throw new Error("Permission insuffisante.");
  return { type: "USER" as const, userId: session.user.id };
}

function firstFieldError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

export async function updateTemplateAction(
  key: string,
  _prevState: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  try {
    const actor = await requireStaff("notifications.manage");
    const input = templateSchema.parse({
      subjectFr: formData.get("subjectFr") ?? "",
      subjectEn: formData.get("subjectEn") ?? "",
      bodyFr: formData.get("bodyFr"),
      bodyEn: formData.get("bodyEn"),
    });
    const edition = await getActiveEdition();
    await updateTemplate(edition.id, key, input, actor);
    revalidatePath(`/admin/notifications/${key}`);
    revalidatePath("/admin/notifications");
    return { success: "Modèle enregistré." };
  } catch (error) {
    return { error: firstFieldError(error) };
  }
}

/**
 * Envoi groupé en **deux temps** : un premier appel calcule la population
 * touchée et la renvoie pour confirmation, un second (avec `confirm`) met
 * réellement en file. Un envoi de masse ne doit pas partir sur un seul clic.
 */
export async function sendBulkAction(
  _prevState: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  try {
    const actor = await requireStaff("notifications.send_bulk");
    const input = bulkSendSchema.parse({
      templateKey: formData.get("templateKey"),
      status: formData.get("status") ?? "",
      categoryId: formData.get("categoryId") ?? "",
      country: formData.get("country") ?? "",
    });
    const edition = await getActiveEdition();
    const filter = {
      status: input.status || undefined,
      categoryId: input.categoryId || undefined,
      country: input.country || undefined,
    };

    if (formData.get("confirm") !== "1") {
      const preview = await previewBulk(edition.id, filter);
      return {
        preview: {
          total: preview.total,
          templateKey: input.templateKey,
          filter: {
            status: input.status ?? "",
            categoryId: input.categoryId ?? "",
            country: input.country ?? "",
          },
          sample: preview.sample.map(
            (p) => `${p.firstName} ${p.lastName} <${p.email}> (${p.locale})`,
          ),
        },
      };
    }

    const result = await enqueueBulk({
      editionId: edition.id,
      templateKey: input.templateKey,
      filter,
      actor,
    });
    revalidatePath("/admin/notifications");
    return {
      success: `${result.queued} message(s) mis en file (campagne ${result.campaignId.slice(0, 8)}).`,
    };
  } catch (error) {
    return { error: firstFieldError(error) };
  }
}

/**
 * Programme les rappels J-7 et J-1 (brief §14).
 *
 * Volontairement déclenché à la main plutôt qu'automatiquement : le comité
 * choisit le moment où il estime la liste des confirmés assez stable, et
 * l'opération est rejouable sans doublon.
 */
export async function planifierRappelsAction(): Promise<
  NotificationActionState & { message?: string }
> {
  try {
    const session = await auth();
    if (!can(session, "notifications.send_bulk")) return { error: "Permission refusée." };

    const edition = await getActiveEdition();
    const { planifier } = await import("./reminders");
    const resultat = await planifier(edition.id, edition.startDate, session?.user?.id);

    revalidatePath("/admin/notifications");

    const parties: string[] = [`${resultat.programmes} rappel(s) programmé(s)`];
    if (resultat.ignores > 0) {
      parties.push(`${resultat.ignores} ignoré(s), déjà envoyés`);
    }
    if (resultat.echeancesDepassees.length > 0) {
      parties.push(`échéance(s) passée(s) : ${resultat.echeancesDepassees.join(", ")}`);
    }
    return { message: `${parties.join(" · ")}.` };
  } catch (error) {
    return { error: firstFieldError(error) };
  }
}
