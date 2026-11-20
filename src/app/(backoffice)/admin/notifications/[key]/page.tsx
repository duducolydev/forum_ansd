import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { LANGUES } from "@/lib/langue";
import {
  adresseDuSite,
  getTemplate,
  piedDeCourriel,
  templateVariables,
} from "@/modules/notifications/service";
import type { PiedCourriel } from "@/modules/notifications/courriel";
import { declenchement, EXEMPLES, variablesResolues } from "@/modules/notifications/catalogue";
import { TemplateForm } from "@/modules/notifications/components/template-form";

export const dynamic = "force-dynamic";

export default async function TemplatePage({ params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session, "notifications.manage")) {
    redirect("/admin");
  }

  const { key } = await params;
  const edition = await getActiveEdition();
  const template = await getTemplate(edition.id, key);
  if (!template) notFound();

  const declared = templateVariables(template);
  const quandPart = declenchement(template.key);

  /*
   * Signature du gabarit, dans les trois langues : l'aperçu bascule de l'une à
   * l'autre sans repasser par le serveur, et doit montrer le message tel
   * qu'il partira — pied compris.
   */
  const pieds = Object.fromEntries(
    await Promise.all(
      LANGUES.map(async (langue) => [langue, await piedDeCourriel(edition.id, langue)] as const),
    ),
  ) as Record<(typeof LANGUES)[number], PiedCourriel>;

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/notifications" className="text-text-3 text-sm">
          ← Notifications
        </Link>
        <h2 className="mt-1 text-2xl">{template.key}</h2>
        {quandPart && <p className="text-text-3 mt-1 text-sm">{quandPart}</p>}
      </div>

      <TemplateForm
        templateKey={template.key}
        subjectFr={template.subjectFr ?? ""}
        subjectEn={template.subjectEn ?? ""}
        subjectPt={template.subjectPt ?? ""}
        bodyFr={template.bodyFr}
        bodyEn={template.bodyEn}
        bodyPt={template.bodyPt ?? ""}
        declared={declared}
        // Ce qui sera réellement remplacé à l'envoi : le programme s'y ajoute,
        // utilisable dans n'importe quel modèle.
        resolues={variablesResolues(template.key, declared)}
        sampleVariables={EXEMPLES}
        pieds={pieds}
        baseUrl={adresseDuSite()}
      />
    </div>
  );
}
