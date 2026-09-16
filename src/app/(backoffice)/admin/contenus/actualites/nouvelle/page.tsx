import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { createPostAction } from "@/modules/content/actions";
import { PostForm } from "@/modules/content/components/post-form";

export default async function NewPostPage() {
  const session = await auth();
  if (!session?.user || !can(session, "content.write")) {
    redirect("/admin/contenus/actualites");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-5 text-2xl">Nouvel article</h2>
      <div className="border-border bg-surface rounded-xl border p-6">
        <PostForm action={createPostAction} submitLabel="Créer l'article" />
      </div>
    </div>
  );
}
