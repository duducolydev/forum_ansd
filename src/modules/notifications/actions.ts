"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import type { Permission } from "@/lib/permissions";
import { getActiveEdition } from "@/lib/edition";
import { dureeCampagneMinutes } from "@/lib/cadence-envoi";
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
    filter: { status: string; categoryId: string; country: string; exclureDejaRecu: boolean };
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
      subjectPt: formData.get("subjectPt") ?? "",
      bodyPt: formData.get("bodyPt") ?? "",
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
      exclureDejaRecu: formData.get("exclureDejaRecu") === "1",
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
            exclureDejaRecu: input.exclureDejaRecu ?? false,
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
      exclureDejaRecu: input.exclureDejaRecu,
      actor,
    });
    revalidatePath("/admin/notifications");
    return {
      success:
        `${result.queued} message(s) mis en file (campagne ${result.campaignId.slice(0, 8)}), ` +
        `étalés sur ~${dureeCampagneMinutes(result.queued)} min.` +
        (result.exclus > 0 ? ` ${result.exclus} déjà servi(s), écarté(s).` : ""),
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

/**
 * Renvoi des envois restés en échec (bouton de l'historique d'envoi).
 *
 * Le rattrapage du 18 novembre 2026 : ~250 confirmations et badges refusés
 * faute de quota, sans moyen de les réémettre autrement qu'un par un.
 */
export async function renvoyerEchecsAction(): Promise<NotificationActionState> {
  try {
    const actor = await requireStaff("notifications.manage");
    const edition = await getActiveEdition();
    const { renvoyerEchecs } = await import("./renvoi");
    const bilan = await renvoyerEchecs(edition.id, actor);

    revalidatePath("/admin/notifications");
    revalidatePath("/admin/notifications/historique");

    if (bilan.remis === 0) {
      return {
        success:
          bilan.adressesMortes > 0
            ? `Aucun envoi à reprendre · ${bilan.adressesMortes} adresse(s) inexistante(s) à corriger.`
            : "Aucun envoi en échec à reprendre.",
      };
    }
    const minutes = dureeCampagneMinutes(bilan.remis);
    const parties = [`${bilan.remis} envoi(s) remis en file`];
    if (minutes > 0) parties.push(`étalés sur ~${minutes} min`);
    if (bilan.ignores > 0) parties.push(`${bilan.ignores} non renvoyable(s)`);
    // Une adresse inexistante ne se renvoie pas, elle se corrige : le dire ici
    // est le seul endroit où quelqu'un le verra.
    if (bilan.adressesMortes > 0) {
      parties.push(`${bilan.adressesMortes} adresse(s) inexistante(s) à corriger`);
    }
    return { success: `${parties.join(" · ")}.` };
  } catch (error) {
    return { error: firstFieldError(error) };
  }
}

/** Relevé immédiat des rebonds différés (bouton de l'historique d'envoi). */
export async function releverRebondsAction(): Promise<NotificationActionState> {
  try {
    await requireStaff("notifications.manage");
    const { configImap, releverRebondsUneFois } = await import("./rebonds");
    if (!configImap()) {
      return { error: "La lecture de la boîte d'envoi n'est pas configurée sur ce serveur." };
    }
    const bilan = await releverRebondsUneFois();
    revalidatePath("/admin/notifications");
    revalidatePath("/admin/notifications/historique");
    return {
      success:
        bilan.nouveaux > 0
          ? `${bilan.nouveaux} nouveau(x) rebond(s) reporté(s).`
          : "Aucun nouveau rebond dans la boîte d'envoi.",
    };
  } catch (error) {
    return { error: firstFieldError(error) };
  }
}
