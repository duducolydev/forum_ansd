import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { LienExterne } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { listerSections } from "@/modules/sections/service";
import { PAGES, typeSection } from "@/modules/sections/catalogue";
import { lireContenu } from "@/modules/sections/schema";
import { AjoutSection } from "@/modules/sections/components/ajout-section";
import { CarteSection } from "@/modules/sections/components/carte-section";
import { RepriseComposition } from "@/modules/sections/components/reprise-composition";
import { COMPOSITIONS } from "@/modules/sections/defaut";

export const metadata = { title: "Sections de page" };

/**
 * Composition des pages publiques (§8.4).
 *
 * Rattaché à `content.write` et non à `settings.write` : composer une page est
 * un acte éditorial, que le §12 confie au gestionnaire de communication.
 */
export default async function SectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !can(session, "content.write")) {
    redirect("/admin");
  }

  const { page: demandee } = await searchParams;
  const page = PAGES.some((candidate) => candidate.cle === demandee) ? demandee! : PAGES[0]!.cle;

  const edition = await getActiveEdition();
  const sections = await listerSections(edition.id, page);
  const composition = COMPOSITIONS[page] ?? [];
  const cheminPublic = PAGES.find((candidate) => candidate.cle === page)!.chemin;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Link href="/admin/parametres" className="text-link text-sm">
            ← Paramètres
          </Link>
          <h2 className="mt-1 text-2xl">Sections de page</h2>
          <span className="text-text-3 text-sm">
            {sections.length === 0
              ? "Aucune section : la page affiche sa composition d'origine."
              : `${sections.length} section${sections.length > 1 ? "s" : ""}, dans l'ordre d'affichage.`}
          </span>
        </div>
        <LienExterne
          href={cheminPublic}
          target="_blank"
          rel="noopener noreferrer"
          icone={ExternalLink}
        >
          Voir la page
        </LienExterne>
      </div>

      {sections.length === 0 && (
        <div className="border-border bg-surface text-text-2 mb-4 rounded-xl border p-5 text-sm">
          <p>
            Tant qu&apos;aucune section n&apos;est enregistrée, la page publique affiche sa
            composition d&apos;origine
            {composition.length > 0 &&
              ` : ${composition.map((modele) => typeSection(modele.type)?.label ?? modele.type).join(", ")}`}
            .
          </p>
          <p className="mt-2">
            <strong>Modifier la composition actuelle</strong> la reprend telle quelle et rend chaque
            section réglable (grand logo, boutons, textes…) : rien ne change à l&apos;écran, et vous
            pouvez ensuite réordonner, masquer ou supprimer chaque section. Ajouter une section la
            reprend aussi, avant d&apos;y ajouter la nouvelle.
          </p>
          {composition.length > 0 && <RepriseComposition page={page} />}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3">
        {sections.map((section, rang) => {
          const modele = typeSection(section.type);
          if (!modele) return null;
          return (
            <CarteSection
              key={section.id}
              modele={modele}
              section={{
                id: section.id,
                type: section.type,
                variant: section.variant,
                isVisible: section.isVisible,
                contentFr: lireContenu(section.contentFr),
                contentEn: lireContenu(section.contentEn),
                settings: (section.settings as Record<string, unknown> | null) ?? {},
                premiere: rang === 0,
                derniere: rang === sections.length - 1,
              }}
            />
          );
        })}
      </div>

      <AjoutSection page={page} />
    </div>
  );
}
