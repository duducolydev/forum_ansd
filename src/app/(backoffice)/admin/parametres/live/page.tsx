import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { LienExterne } from "@/components/ui/bouton";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { lireParametres } from "@/modules/settings/service";
import { etatDirect } from "@/modules/settings/regles";
import { urlPageVideo } from "@/modules/medias/video";
import { creneauxDiffusion } from "@/modules/direct/service";
import { FormulaireDirect } from "@/modules/settings/components/formulaire-direct";

export const metadata = { title: "Diffusion en direct" };

/**
 * Réglages du direct (19 novembre 2026).
 *
 * Écran à part, et non un panneau de plus sous « Paramètres » : pendant les
 * trois jours du Forum, c'est le seul qu'on ouvrira, souvent dans l'urgence —
 * une coupure de flux, une séance qui déborde. L'interrupteur d'antenne ne
 * doit pas se trouver sous le thème et le pied de page.
 *
 * L'état courant est affiché en tête : sans lui, on ne saurait pas, depuis le
 * BackOffice, ce que voit le public à cet instant — et c'est exactement la
 * question qu'on se pose en ouvrant cette page.
 */
export default async function LivePage() {
  const session = await auth();
  if (!session?.user || !can(session, "settings.write")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const parametres = lireParametres(edition);
  const direct = parametres.direct;

  const creneaux = await creneauxDiffusion(edition.id, "fr");
  const etat = etatDirect(direct.mode, direct.margeMinutes, creneaux, new Date());

  const lien = direct.video
    ? (urlPageVideo(direct.video.fournisseur, direct.video.identifiant) ?? "")
    : "";

  const quoi = !direct.actif
    ? "La page publique est fermée : /direct répond 404."
    : !direct.video
      ? "Aucune diffusion réglée : le public voit l'écran d'attente."
      : etat.antenne
        ? "Le lecteur est à l'écran."
        : "Le public voit l'écran d'attente.";

  const pourquoi =
    direct.mode === "auto"
      ? etat.courant
        ? `Session en cours : ${etat.courant.titre}.`
        : etat.suivant
          ? `Prochaine session : ${etat.suivant.titre}.`
          : etat.termine
            ? "Toutes les sessions publiées sont passées."
            : "Aucune session publiée : rien à suivre automatiquement."
      : direct.mode === "antenne"
        ? "Antenne forcée : le programme n'est pas consulté."
        : "Intermède forcé : le programme n'est pas consulté.";

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/parametres" className="text-link text-sm">
            ← Paramètres
          </Link>
          <h2 className="mt-1 text-2xl">Diffusion en direct</h2>
          <span className="text-text-3 text-sm">
            Édition {edition.code} — ce que voit le public sur la page « En direct ».
          </span>
        </div>
        {direct.actif && (
          <LienExterne
            href="/direct"
            target="_blank"
            rel="noopener noreferrer"
            icone={ExternalLink}
          >
            Voir la page
          </LienExterne>
        )}
      </div>

      <div className="border-border bg-surface mb-4 rounded-xl border p-5 text-sm">
        <p className="text-heading font-semibold">{quoi}</p>
        <p className="text-text-3 mt-1 text-xs">{pourquoi}</p>
        <p className="text-text-3 mt-2 text-xs">
          Côté public, cet état est recalculé toutes les dix secondes sans rechargement : un
          changement enregistré ici est visible au prochain chargement de la page, et la bascule
          entre lecteur et écran d&apos;attente se fait toute seule.
        </p>
      </div>

      <FormulaireDirect valeurs={direct} lien={lien} />

      <div className="border-border bg-surface text-text-2 mt-4 rounded-xl border p-5 text-xs">
        <p className="text-heading text-sm font-semibold">Avant la première diffusion</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Dans YouTube Studio, l&apos;option <strong>« Autoriser l&apos;intégration »</strong>{" "}
            doit être cochée sur la diffusion : sans elle, le lecteur reste noir, sans message
            d&apos;erreur.
          </li>
          <li>
            Une diffusion marquée <strong>« contenu destiné aux enfants »</strong> ou soumise à une
            limite d&apos;âge ne peut pas être intégrée.
          </li>
          <li>
            Une diffusion <strong>privée</strong> ne s&apos;intègre pas ; une diffusion non
            répertoriée, oui.
          </li>
          <li>
            Testez la page <strong>depuis le réseau de la salle</strong> : un filtrage ou un débit
            saturé sur place ne se découvre pas le jour J.
          </li>
          <li>
            Après une coupure, YouTube crée une <strong>nouvelle</strong> diffusion : revenez coller
            la nouvelle adresse ici.
          </li>
        </ul>
      </div>
    </div>
  );
}
