import Link from "next/link";
import { KeyRound, LayoutTemplate, Tags } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { lireParametres } from "@/modules/settings/service";
import { FormulaireIdentite } from "@/modules/settings/components/formulaire-identite";
import { FormulaireInscriptions } from "@/modules/settings/components/formulaire-inscriptions";
import { FormulaireTheme } from "@/modules/settings/components/formulaire-theme";
import { FormulairePiedDePage } from "@/modules/settings/components/formulaire-pied-de-page";

export const metadata = { title: "Paramètres" };

/** Jour au format des champs `<input type="date">`, en UTC (= heure de Dakar). */
function jour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Paramètres de l'édition (brief §5.14).
 *
 * Réservé à `settings.write`, que seul le SUPER_ADMIN porte par défaut : ces
 * réglages décident de ce que le public voit et de qui peut s'inscrire.
 */
export default async function ParametresPage() {
  const session = await auth();
  if (!session?.user || !can(session, "settings.write")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const parametres = lireParametres(edition);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Paramètres</h2>
          <span className="text-text-3 text-sm">
            Édition {edition.code} — les changements d&apos;apparence et de pied de page
            s&apos;appliquent à tout le site public.
          </span>
        </div>
        <div className="flex gap-2">
          <LienBouton href="/admin/parametres/categories" icone={Tags}>
            Catégories
          </LienBouton>
          <LienBouton href="/admin/parametres/roles" icone={KeyRound}>
            Rôles
          </LienBouton>
          <LienBouton href="/admin/parametres/sections" icone={LayoutTemplate}>
            Sections
          </LienBouton>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <FormulaireIdentite
          valeurs={{
            title: edition.title,
            theme: edition.theme ?? "",
            startDate: jour(edition.startDate),
            endDate: jour(edition.endDate),
            venue: edition.venue,
            city: edition.city,
          }}
        />
        <FormulaireInscriptions valeurs={parametres.inscriptions} />
        <FormulaireTheme valeurs={parametres.theme} />
        <FormulairePiedDePage valeurs={parametres.piedDePage} />

        <p className="text-text-3 text-xs">
          Les textes légaux (mentions et politique de confidentialité) se modifient sous{" "}
          <Link href="/admin/contenus" className="text-link">
            Contenus
          </Link>
          , avec le reste des zones éditoriales.
        </p>
      </div>
    </div>
  );
}
