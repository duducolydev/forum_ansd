import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { getTemplate, templateVariables } from "@/modules/notifications/service";
import { TemplateForm } from "@/modules/notifications/components/template-form";

export const dynamic = "force-dynamic";

/** Valeurs d'exemple de la prévisualisation — jamais de données réelles ici. */
const SAMPLE: Record<string, string> = {
  prenom: "Aminata",
  nom: "Sow",
  identifiant: "FID26-7K3M2P",
  lien_connexion: "https://forum.ansd.sn/mon-espace/lien/xxxxx",
  lien_inscription: "https://forum.ansd.sn/inscription?inv=xxxxx",
  lien_espace: "https://forum.ansd.sn/mon-espace",
  lien_badge: "https://forum.ansd.sn/mon-espace",
  code6: "123456",
  date_limite: "15 octobre 2026",
};

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

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/notifications" className="text-text-3 text-sm">
          ← Notifications
        </Link>
        <h2 className="mt-1 text-2xl">{template.key}</h2>
      </div>

      <TemplateForm
        templateKey={template.key}
        subjectFr={template.subjectFr ?? ""}
        subjectEn={template.subjectEn ?? ""}
        bodyFr={template.bodyFr}
        bodyEn={template.bodyEn}
        declared={declared}
        sampleVariables={SAMPLE}
      />
    </div>
  );
}
