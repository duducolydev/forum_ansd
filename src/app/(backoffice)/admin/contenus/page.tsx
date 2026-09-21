import { Newspaper } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "@/modules/content/service";
import { CONTENT_BLOCK_KEYS } from "@/modules/content/keys";
import { ContentBlockForm } from "@/modules/content/components/content-block-form";

export default async function ContentBlocksPage() {
  const session = await auth();
  if (!session?.user || !can(session, "content.read")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const blocks = await service.listContentBlocks(edition.id);
  const byKey = new Map(blocks.map((block) => [block.key, block]));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Contenus</h2>
          <span className="text-text-3 text-sm">Zones éditoriales du site public</span>
        </div>
        <LienBouton href="/admin/contenus/actualites" icone={Newspaper}>
          Actualités
        </LienBouton>
      </div>

      <div className="flex flex-col gap-4">
        {CONTENT_BLOCK_KEYS.map(({ key, label, riche, max }) => {
          const block = byKey.get(key);
          return (
            <ContentBlockForm
              key={key}
              contentKey={key}
              label={label}
              riche={riche}
              max={max}
              valueFr={typeof block?.valueFr === "string" ? block.valueFr : ""}
              valueEn={typeof block?.valueEn === "string" ? block.valueEn : ""}
            />
          );
        })}
      </div>
    </div>
  );
}
