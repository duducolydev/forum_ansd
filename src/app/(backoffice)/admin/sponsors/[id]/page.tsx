import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "@/modules/sponsors/service";
import { FormulaireSponsor } from "@/modules/sponsors/components/formulaire-sponsor";
import { PanneauLogo } from "@/modules/sponsors/components/panneau-logo";

export const metadata = { title: "Sponsor" };

export default async function SponsorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session, "sponsors.write")) {
    redirect("/admin");
  }

  const { id } = await params;
  const edition = await getActiveEdition();
  const [sponsor, niveaux] = await Promise.all([
    service.trouverSponsor(id),
    service.listerNiveaux(edition.id),
  ]);

  if (!sponsor || sponsor.editionId !== edition.id) notFound();

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/sponsors" className="text-link text-sm">
          ← Sponsors
        </Link>
        <h2 className="mt-1 text-2xl">{sponsor.name}</h2>
        <span className="text-text-3 text-sm">
          {sponsor.level.name} · {sponsor.isPublished ? "publié sur le site" : "brouillon"}
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_300px]">
        <FormulaireSponsor
          sponsorId={sponsor.id}
          niveaux={niveaux.map(({ id: niveauId, name }) => ({ id: niveauId, name }))}
          valeurs={{
            name: sponsor.name,
            levelId: sponsor.levelId,
            descriptionFr: sponsor.descriptionFr ?? "",
            descriptionEn: sponsor.descriptionEn ?? "",
            website: sponsor.website ?? "",
            videoUrl: sponsor.videoUrl ?? "",
            standNumber: sponsor.standNumber ?? "",
            contactName: sponsor.contactName ?? "",
            contactEmail: sponsor.contactEmail ?? "",
            isPublished: sponsor.isPublished,
          }}
        />
        <PanneauLogo
          sponsorId={sponsor.id}
          cheminLogo={sponsor.logoPath ?? ""}
          nom={sponsor.name}
        />
      </div>
    </div>
  );
}
