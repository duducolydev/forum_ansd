import { PenLine, Pencil } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "@/modules/content/service";

export default async function PostsPage() {
  const session = await auth();
  if (!session?.user || !can(session, "content.read")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const posts = await service.listPosts(edition.id);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Actualités</h2>
          <span className="text-text-3 text-sm">{posts.length} article(s)</span>
        </div>
        {can(session, "content.write") && (
          <LienBouton href="/admin/contenus/actualites/nouvelle" ton="principal" icone={PenLine}>
            Nouvel article
          </LienBouton>
        )}
      </div>

      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold">
                Titre
              </th>
              <th className="border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold">
                Statut
              </th>
              <th className="border-border bg-surface-2 border-b px-3.5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="hover:bg-blue-soft">
                <td className="border-border text-heading border-b px-3.5 py-3 font-semibold">
                  {post.titleFr}
                </td>
                <td className="border-border border-b px-3.5 py-3">
                  {post.isPublished ? (
                    <span className="bg-accent-soft text-accent-text rounded-md px-2.5 py-1 text-xs font-semibold">
                      Publié
                    </span>
                  ) : (
                    <span className="bg-bg-3 text-text-2 rounded-md px-2.5 py-1 text-xs font-semibold">
                      Brouillon
                    </span>
                  )}
                </td>
                <td className="border-border border-b px-3.5 py-3">
                  <LienBouton
                    href={`/admin/contenus/actualites/${post.id}/modifier`}
                    ton="discret"
                    taille="petit"
                    icone={Pencil}
                  >
                    Modifier
                  </LienBouton>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={3} className="text-text-3 px-3.5 py-8 text-center">
                  Aucun article.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
