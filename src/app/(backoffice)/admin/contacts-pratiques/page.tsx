import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { listContacts } from "@/modules/hotels/service";
import { ContactsPratiques } from "@/modules/hotels/components/contacts-pratiques";

export default async function ContactsPratiquesPage() {
  const session = await auth();
  if (!session?.user || !can(session, "hotels.manage")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const contacts = await listContacts(edition.id);

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="mb-1 text-2xl">Contacts pratiques</h2>
      <p className="text-text-2 mb-5 max-w-[80ch] text-sm">
        Publiés sur <strong>Infos pratiques &rsaquo; Contacts</strong>. Ce sont les coordonnées
        qu&apos;un participant cherche quand il ne sait pas à qui s&apos;adresser : donnez-leur un
        intitulé qui dit le sujet, pas le service.
      </p>

      <div className="border-border bg-surface rounded-xl border p-6">
        <ContactsPratiques contacts={contacts} />
      </div>
    </div>
  );
}
