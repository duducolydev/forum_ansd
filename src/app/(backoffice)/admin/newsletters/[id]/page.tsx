import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { BOITES } from "@/lib/mail";
import { getActiveEdition } from "@/lib/edition";
import { STATUS_LABELS } from "@/modules/participants/components/status-badge";
import { aUnCorps, trouverNewsletter, urlFichier } from "@/modules/newsletters/service";
import { avancementEnvoi, boitesDisponibles, lireLots } from "@/modules/newsletters/envoi";
import { lireAudience, STATUTS_NEWSLETTER } from "@/modules/newsletters/schema";
import { FormulaireNewsletter } from "@/modules/newsletters/components/formulaire-newsletter";
import {
  PublicationNewsletter,
  TablePlan,
} from "@/modules/newsletters/components/publication-newsletter";

export const dynamic = "force-dynamic";

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Dakar",
});

/**
 * Fiche d'une newsletter : texte et fichier, publication et envoi,
 * suppression (§34, refondue le 25 novembre 2026).
 */
export default async function FicheNewsletterPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session, "content.write")) {
    redirect("/admin/newsletters");
  }

  const { id } = await params;
  const newsletter = await trouverNewsletter(id);
  if (!newsletter) notFound();

  const edition = await getActiveEdition();
  const envoyee = Boolean(newsletter.sentAt);

  const [categories, effectifs, boites, avancement] = await Promise.all([
    prisma.participantCategory.findMany({
      where: { editionId: edition.id, isActive: true },
      select: { id: true, labelFr: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.participant.groupBy({
      by: ["categoryId"],
      where: {
        editionId: edition.id,
        deletedAt: null,
        status: { in: [...STATUTS_NEWSLETTER] },
      },
      _count: { _all: true },
    }),
    envoyee ? Promise.resolve([]) : boitesDisponibles(),
    avancementEnvoi(newsletter),
  ]);
  const effectifPar = new Map(effectifs.map((ligne) => [ligne.categoryId, ligne._count._all]));
  const libellesBoites = Object.fromEntries(
    Object.entries(BOITES).map(([cle, boite]) => [cle, boite.libelle]),
  );
  const audience = lireAudience(newsletter.audience);
  const libellesCategories = audience?.categoryIds.length
    ? categories
        .filter((categorie) => audience.categoryIds.includes(categorie.id))
        .map((categorie) => categorie.labelFr)
        .join(", ")
    : "toutes";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <Link href="/admin/newsletters" className="text-link text-sm">
          ← Newsletters
        </Link>
        <h2 className="mt-1 text-2xl">{newsletter.titleFr}</h2>
        <span className="text-text-3 text-sm">
          {newsletter.publishedAt && newsletter.isPublished
            ? `Publiée le ${dateLongue.format(newsletter.publishedAt)}`
            : "Brouillon"}
          {newsletter.sentAt ? ` · envoyée le ${dateLongue.format(newsletter.sentAt)}` : ""}
          {newsletter.isPublished ? ` · ${newsletter.downloadCount} téléchargement(s)` : ""}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-4 text-sm">
        {newsletter.isPublished && (
          <Link
            href={`/newsletters/${newsletter.slug}`}
            className="text-link flex items-center gap-1.5 underline"
          >
            Voir sur le portail
            <ExternalLink aria-hidden size={13} />
          </Link>
        )}
        {newsletter.filePath && (
          <a
            href={urlFichier(newsletter.id)}
            className="text-link flex items-center gap-1.5 underline"
          >
            Télécharger le fichier
            <Download aria-hidden size={13} />
          </a>
        )}
      </div>

      {!newsletter.filePath && (
        <p className="text-warn-text bg-warn-soft mb-5 rounded-lg px-4 py-3 text-sm">
          {aUnCorps(newsletter)
            ? "Newsletter rédigée avant le passage aux fichiers PDF : son texte reste affiché sur le portail. Vous pouvez y joindre un fichier."
            : "Aucun fichier PDF : déposez-le ci-dessous pour pouvoir publier la newsletter."}
        </p>
      )}

      <div className="border-border bg-surface mb-5 rounded-xl border p-6">
        <FormulaireNewsletter
          newsletterId={newsletter.id}
          fichierActuel={
            newsletter.filePath
              ? { nom: newsletter.fileName ?? "newsletter.pdf", octets: newsletter.fileSize }
              : null
          }
          defaultValues={{
            titleFr: newsletter.titleFr,
            titleEn: newsletter.titleEn === newsletter.titleFr ? "" : newsletter.titleEn,
            titlePt: newsletter.titlePt ?? "",
            excerptFr: newsletter.excerptFr,
            excerptEn: newsletter.excerptEn === newsletter.excerptFr ? "" : newsletter.excerptEn,
            excerptPt: newsletter.excerptPt ?? "",
          }}
        />
      </div>

      {envoyee ? (
        <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-6">
          <h3 className="text-lg">Envoi</h3>
          <p className="text-text-2 text-sm">
            Envoyée le <strong>{dateLongue.format(newsletter.sentAt!)}</strong> à{" "}
            {newsletter.sentCount} participant(s) — catégories : {libellesCategories}
            {audience?.statuts.length
              ? ` ; statuts : ${audience.statuts
                  .map((statut) => STATUS_LABELS[statut as keyof typeof STATUS_LABELS] ?? statut)
                  .join(", ")}`
              : ""}
            . Un second envoi n&apos;est pas possible.
          </p>
          {avancement && (
            <p className="text-text text-sm">
              <strong className="text-accent-text">{avancement.partis}</strong> parti(s) ·{" "}
              <strong className={avancement.echecs ? "text-danger-text" : ""}>
                {avancement.echecs}
              </strong>{" "}
              en échec · <strong>{avancement.restants}</strong> à venir
              <span className="text-text-3 block text-xs">
                Les échecs se renvoient depuis Notifications › Historique.
              </span>
            </p>
          )}
          <TablePlan lots={lireLots(newsletter.envoi)} libelles={libellesBoites} />
        </div>
      ) : (
        <PublicationNewsletter
          id={newsletter.id}
          titre={newsletter.titleFr}
          publiee={newsletter.isPublished}
          aUnFichier={Boolean(newsletter.filePath)}
          categories={categories.map((categorie) => ({
            id: categorie.id,
            libelle: categorie.labelFr,
            effectif: effectifPar.get(categorie.id) ?? 0,
          }))}
          statuts={STATUTS_NEWSLETTER.map((statut) => ({
            valeur: statut,
            libelle: STATUS_LABELS[statut],
          }))}
          boites={boites.map((boite) => ({
            boite: boite.boite,
            libelle: boite.libelle,
            sert: boite.sert,
            adresse: boite.adresse,
            quota: boite.quota,
            plafond: boite.plafond,
            dejaUtilise: boite.dejaUtilise,
            partageAvec: boite.partageAvec,
          }))}
        />
      )}
    </div>
  );
}
