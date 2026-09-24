import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { trouverNewsletter } from "@/modules/newsletters/service";
import { lireImages } from "@/modules/newsletters/schema";
import { modifierNewsletterAction } from "@/modules/newsletters/actions";
import { FormulaireNewsletter } from "@/modules/newsletters/components/formulaire-newsletter";
import { EnvoiNewsletter } from "@/modules/newsletters/components/envoi-newsletter";

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Africa/Dakar",
});

/**
 * Fiche d'une newsletter : rédaction, envoi, suppression (§34).
 *
 * Tout sur une page plutôt qu'en onglets : on relit le texte juste avant de
 * l'envoyer, et changer d'écran entre les deux gestes inviterait à envoyer sans
 * avoir relu.
 */
export default async function FicheNewsletterPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session, "content.write")) {
    redirect("/admin/newsletters");
  }

  const { id } = await params;
  const newsletter = await trouverNewsletter(id);
  if (!newsletter) notFound();

  const boundAction = modifierNewsletterAction.bind(null, newsletter.id);
  const cles = lireImages(newsletter.images).map((_, rang) => rang);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <Link href="/admin/newsletters" className="text-link text-sm">
          ← Newsletters
        </Link>
        <h2 className="mt-1 text-2xl">{newsletter.titleFr}</h2>
        <span className="text-text-3 text-sm">
          {newsletter.publishedAt
            ? `Publiée le ${dateLongue.format(newsletter.publishedAt)}`
            : "Brouillon"}
          {newsletter.sentAt ? ` · envoyée le ${dateLongue.format(newsletter.sentAt)}` : ""}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-4 text-sm">
        {newsletter.isPublished && (
          <Link
            href={`/newsletters/${newsletter.slug}`}
            className="text-link flex items-center gap-1.5 underline"
          >
            Voir sur le site
            <ExternalLink aria-hidden size={13} />
          </Link>
        )}
        <Link
          href={`/api/v1/newsletters/${newsletter.id}/pdf`}
          className="text-link flex items-center gap-1.5 underline"
        >
          Télécharger le PDF
          <Download aria-hidden size={13} />
        </Link>
      </div>

      <div className="border-border bg-surface mb-5 rounded-xl border p-6">
        <FormulaireNewsletter
          action={boundAction}
          submitLabel="Enregistrer"
          newsletterId={newsletter.id}
          clesImages={cles}
          defaultValues={{
            titleFr: newsletter.titleFr,
            titleEn: newsletter.titleEn,
            excerptFr: newsletter.excerptFr,
            excerptEn: newsletter.excerptEn,
            bodyFr: newsletter.bodyFr,
            bodyEn: newsletter.bodyEn,
            isPublished: newsletter.isPublished,
          }}
        />
      </div>

      <EnvoiNewsletter
        id={newsletter.id}
        titre={newsletter.titleFr}
        publiee={newsletter.isPublished}
        envoyeeLe={newsletter.sentAt ? dateLongue.format(newsletter.sentAt) : null}
        destinataires={newsletter.sentCount}
      />
    </div>
  );
}
