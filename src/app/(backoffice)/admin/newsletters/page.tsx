import { redirect } from "next/navigation";
import { ArrowUpRight, Plus } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { listerNewsletters } from "@/modules/newsletters/service";

export const metadata = { title: "Newsletters" };

const TH =
  "border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold";
const TD = "border-border border-b px-3.5 py-3";

const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeZone: "Africa/Dakar",
});

/**
 * Newsletters (§34).
 *
 * La colonne « Envoyée » précède « Publiée » : une newsletter publiée mais
 * jamais envoyée est le cas qu'on vient repérer ici, et c'est la seule action
 * qui ne se rattrape pas.
 */
export default async function NewslettersAdminPage() {
  const session = await auth();
  if (!session?.user || !can(session, "content.read")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const newsletters = await listerNewsletters(edition.id);
  const envoyees = newsletters.filter((n) => n.sentAt).length;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Newsletters</h2>
          <span className="text-text-3 text-sm">
            {newsletters.length} newsletter(s), dont {envoyees} envoyée(s)
          </span>
        </div>
        {can(session, "content.write") && (
          <LienBouton href="/admin/newsletters/nouvelle" ton="principal" icone={Plus}>
            Rédiger
          </LienBouton>
        )}
      </div>

      <p className="text-text-2 mb-5 max-w-[80ch] text-sm">
        Une newsletter se publie sur le site, puis s&apos;envoie aux participants. Les deux gestes
        sont séparés : la publication se corrige, l&apos;envoi non.
      </p>

      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={TH}>Titre</th>
              <th className={TH}>Publiée</th>
              <th className={TH}>Envoyée</th>
              <th className={TH}>Destinataires</th>
              <th className="border-border bg-surface-2 border-b px-3.5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {newsletters.map((newsletter) => (
              <tr key={newsletter.id} className="hover:bg-blue-soft">
                <td className={`${TD} text-heading font-semibold`}>{newsletter.titleFr}</td>
                <td className={TD}>
                  {newsletter.publishedAt ? (
                    dateCourte.format(newsletter.publishedAt)
                  ) : (
                    <span className="text-text-3">Brouillon</span>
                  )}
                </td>
                <td className={TD}>
                  {newsletter.sentAt ? (
                    <span className="text-accent-text">{dateCourte.format(newsletter.sentAt)}</span>
                  ) : (
                    <span className="text-text-3">—</span>
                  )}
                </td>
                <td className={TD}>{newsletter.sentAt ? newsletter.sentCount : "—"}</td>
                <td className={TD}>
                  <LienBouton
                    href={`/admin/newsletters/${newsletter.id}`}
                    ton="discret"
                    taille="petit"
                    icone={ArrowUpRight}
                  >
                    Ouvrir
                  </LienBouton>
                </td>
              </tr>
            ))}
            {newsletters.length === 0 && (
              <tr>
                <td colSpan={5} className="text-text-3 px-3.5 py-8 text-center">
                  Aucune newsletter pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
