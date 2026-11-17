import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { getTemplate, templateVariables } from "@/modules/notifications/service";
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
      />
    </div>
  );
}
