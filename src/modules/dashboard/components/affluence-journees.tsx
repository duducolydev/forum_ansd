import { CalendarCheck, Info, TriangleAlert } from "lucide-react";
import type { AffluenceEdition, JourneeAffluence } from "../affluence";

/**
 * Affluence déclarée, journée par journée (22 novembre 2026).
 *
 * L'écran répond à une question précise : **reste-t-il de quoi valider
 * d'autres demandes, et sur quelle journée ?** Tout ce qui s'y affiche sert
 * cette question — le confirmé déclaré occupe, l'en-attente est le candidat,
 * la jauge est la limite, et l'écart entre les deux est la réponse.
 *
 * Le bandeau d'avertissement n'est pas décoratif. Une déclaration n'engage
 * personne : le badge d'un validé ouvre les trois journées, et qui n'a coché
 * que le 24 peut venir le 23. Remplir une salle jusqu'à sa jauge sur la foi
 * de ces chiffres, c'est la remplir au-delà. Le message est donc **au-dessus**
 * des chiffres, pas en note de bas de page.
 */

/** Seuils d'alerte, en pourcentage de la jauge. */
const TENDU = 80;

function tonOccupation(occupation: number | null): { barre: string; texte: string } {
  if (occupation === null) return { barre: "bg-text-3", texte: "text-text-3" };
  if (occupation >= 100) return { barre: "bg-danger-text", texte: "text-danger-text" };
  if (occupation >= TENDU) return { barre: "bg-warn-text", texte: "text-warn-text" };
  return { barre: "bg-accent-text", texte: "text-accent-text" };
}

function Journee({ journee }: { journee: JourneeAffluence }) {
  const ton = tonOccupation(journee.occupation);
  // La barre se plafonne à 100 % : au-delà, elle ne pourrait plus déborder du
  // cadre, et c'est le texte qui dit le dépassement.
  const largeur = Math.min(journee.occupation ?? 0, 100);

  return (
    <section className="border-border bg-surface carte-relief rounded-xl border p-5">
      <h4 className="text-heading flex items-center gap-2 text-sm font-semibold capitalize">
        <CalendarCheck aria-hidden size={15} className="text-blue-text shrink-0" />
        {journee.libelle}
      </h4>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-heading text-3xl font-semibold">{journee.confirmes}</span>
        <span className="text-text-3 text-xs">
          {journee.jauge === null ? "confirmés déclarés" : `sur ${journee.jauge} places`}
        </span>
      </p>

      {journee.occupation === null ? (
        <p className="text-text-3 mt-3 text-xs">
          Jauge non fixée — à renseigner dans Paramètres pour voir les places disponibles.
        </p>
      ) : (
        <>
          <div
            className="bg-bg-3 mt-3 h-2 overflow-hidden rounded-full"
            role="img"
            aria-label={`${journee.occupation} % de la jauge`}
          >
            <div className={`h-full rounded-full ${ton.barre}`} style={{ width: `${largeur}%` }} />
          </div>
          <p className={`mt-2 text-sm font-semibold ${ton.texte}`}>
            {journee.placesRestantes! >= 0
              ? `${journee.placesRestantes} place(s) disponible(s)`
              : `Jauge dépassée de ${-journee.placesRestantes!}`}
            <span className="text-text-3 ml-1.5 text-xs font-normal">
              · {journee.occupation} % de la jauge
            </span>
          </p>
        </>
      )}

      <p className="text-text-2 mt-3 text-sm">
        <span className="text-heading font-semibold">{journee.enAttente}</span> en attente de
        validation ont déclaré cette journée
      </p>

      {journee.parCategorie.length > 0 && (
        <ul className="text-text-3 mt-3 flex flex-col gap-1 text-xs">
          {journee.parCategorie.slice(0, 4).map((categorie) => (
            <li key={categorie.label} className="flex justify-between gap-3">
              <span className="truncate">{categorie.label}</span>
              <span className="text-text-2 shrink-0 font-semibold">{categorie.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AffluenceJournees({ affluence }: { affluence: AffluenceEdition }) {
  const { journees, sansJour, totaux, parNombreDeJours, ceremonies } = affluence;
  const exploitable = parNombreDeJours.some((ligne) => ligne.jours < journees.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="border-warn-text/40 bg-warn-soft flex items-start gap-3 rounded-lg border p-4">
        <TriangleAlert aria-hidden size={17} className="text-warn-text mt-0.5 shrink-0" />
        <p className="text-text-2 text-sm leading-relaxed">
          <span className="text-heading font-semibold">
            Ces chiffres sont des déclarations, pas des réservations.
          </span>{" "}
          Le badge d&apos;un participant validé ouvre les trois journées, quelle que soit la case
          qu&apos;il a cochée à l&apos;inscription : une personne inscrite pour le seul 24 peut se
          présenter le 23. Une journée affichée à 70 % peut donc se remplir davantage. Dès le soir
          de la première journée, comparez avec le constaté sur l&apos;écran Présences avant de
          valider sur cette base.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {journees.map((journee) => (
          <Journee key={journee.jour} journee={journee} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="border-border bg-surface carte-relief rounded-xl border p-5">
          <h4 className="text-heading text-sm font-semibold">
            Journées déclarées par les confirmés
          </h4>
          <p className="text-text-3 mt-1 mb-3 text-xs">
            {exploitable
              ? "Ceux qui ne viennent qu'un ou deux jours sont les places à récupérer."
              : "Tous ceux qui ont répondu viennent les trois jours : il n'y a pas de place à récupérer par ce biais."}
          </p>
          {parNombreDeJours.length === 0 ? (
            <p className="text-text-2 text-sm">Aucune journée déclarée pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {parNombreDeJours.map((ligne) => (
                <li key={ligne.jours} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-text-2">
                    {ligne.jours} journée{ligne.jours > 1 ? "s" : ""}
                  </span>
                  <span className="text-heading font-semibold">{ligne.valeur}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-border bg-surface carte-relief rounded-xl border p-5">
          <h4 className="text-heading text-sm font-semibold">Sans journée déclarée</h4>
          <p className="text-text-3 mt-1 mb-3 text-xs">
            Inscriptions au comptoir et imports par fichier, qui n&apos;ont pas de case à cocher.
            Ils ne sont comptés sur aucune journée, et viendront pourtant.
          </p>
          <p className="text-heading text-2xl font-semibold">{sansJour.confirmes}</p>
          <p className="text-text-2 mt-1 text-sm">
            confirmés · {sansJour.enAttente} en attente
            <span className="text-text-3 block text-xs">
              sur {totaux.confirmes} confirmés et {totaux.enAttente} en attente au total
            </span>
          </p>
        </section>

        <section className="border-border bg-surface carte-relief rounded-xl border p-5">
          <h4 className="text-heading text-sm font-semibold">Cérémonies</h4>
          <p className="text-text-3 mt-1 mb-3 text-xs">
            Déclarées à part des journées : ce sont elles qui font les pics.
          </p>
          <ul className="flex flex-col gap-2">
            {ceremonies.map((ceremonie) => (
              <li
                key={ceremonie.libelle}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-text-2">{ceremonie.libelle}</span>
                <span className="text-heading font-semibold">
                  {ceremonie.confirmes}
                  <span className="text-text-3 ml-1 text-xs font-normal">
                    +{ceremonie.enAttente}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-text-3 flex items-start gap-2 text-xs">
        <Info aria-hidden size={14} className="mt-0.5 shrink-0" />
        <span>
          Une personne compte sur chacune des journées qu&apos;elle a déclarées : la somme des
          journées dépasse donc le nombre d&apos;inscrits. Les jauges se règlent dans Paramètres →
          Inscriptions.
        </span>
      </p>
    </div>
  );
}
