import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import * as service from "@/modules/content/service";
import { updatePostAction } from "@/modules/content/actions";
import { lireGalerie } from "@/modules/content/schema";
import { PostForm } from "@/modules/content/components/post-form";
import { ImagesArticle } from "@/modules/content/components/images-article";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session, "content.write")) {
    redirect("/admin/contenus/actualites");
  }

  const { id } = await params;
  const post = await service.getPost(id);
  if (!post) notFound();

  const boundAction = updatePostAction.bind(null, post.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-5 text-2xl">Modifier l&apos;article</h2>
      <div className="border-border bg-surface mb-4 rounded-xl border p-6">
        <PostForm
          action={boundAction}
          submitLabel="Enregistrer"
          defaultValues={{
            slug: post.slug,
            titleFr: post.titleFr,
            titleEn: post.titleEn,
            excerptFr: post.excerptFr ?? "",
            excerptEn: post.excerptEn ?? "",
            bodyFr: post.bodyFr,
            bodyEn: post.bodyEn,
            isPublished: post.isPublished,
          }}
        />
      </div>

      {/* Les images ne sont éditables qu'après création : elles se rattachent à
          un article qui existe. */}
      <ImagesArticle
        postId={post.id}
        aUneCouverture={Boolean(post.coverPath)}
        galerie={lireGalerie(post.gallery)}
      />
    </div>
  );
}
