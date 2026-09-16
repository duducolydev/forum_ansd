import Link from "next/link";
import {
  Award,
  Clock,
  Coffee,
  Presentation,
  Sparkles,
  Users,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { ETAT_LABELS, type EtatSession, type PlacesSession } from "../service";
import { TYPE_LABELS } from "../schema";

export interface SessionAffichable {
  id: string;
  slug: string;
  type: keyof typeof TYPE_LABELS;
  titre: string;
  theme: string | null;
  debut: Date;
  fin: Date;
  salle: { id: string; name: string } | null;
  places: PlacesSession;
}

/** Pas de la grille : les sessions du Forum sont calées sur la demi-heure. */
const PAS_MINUTES = 30;

const COULEUR_ETAT: Record<EtatSession, string> = {
  OUVERTE: "bg-accent-soft text-accent-text",
  LISTE_ATTENTE: "bg-warn-soft text-warn-text",
  COMPLETE: "bg-danger-soft text-danger-text",
  CLOTUREE: "bg-blue-soft text-blue-text",
  SANS_RESERVATION: "",
};

/**
 * Filet coloré et icône par type de session.
 *
 * La grille alignait jusqu'ici une trentaine de cartes blanches identiques :
 * repérer une pause au milieu de trois panels demandait de lire chaque titre.
 * Le filet donne la nature de la case avant la lecture ; l'icône la confirme,
 * et le libellé du type reste écrit à côté — rien ne repose sur la seule
 * couleur.
 *
 * Le `Record` est exhaustif sur les types réels : ajouter un type de session
 * sans lui donner d'allure ne compile pas. C'est préférable à un repli
 * silencieux, qui laisserait une case sans repère sans que personne le voie.
 */
const ALLURE_TYPE: Record<
  keyof typeof TYPE_LABELS,
  { rail: string; pastille: string; icone: LucideIcon }
> = {
  OPENING: { rail: "bg-ansd-or", pastille: "text-gold-text", icone: Sparkles },
  INAUGURAL: { rail: "bg-ansd-bleu-vif", pastille: "text-blue-text", icone: Presentation },
  PLENARY: { rail: "bg-ansd-bleu-vif", pastille: "text-blue-text", icone: Presentation },
  PANEL: { rail: "bg-ansd-bleu-vif", pastille: "text-blue-text", icone: Users },
  SIDE_EVENT: { rail: "bg-ansd-vert-vif", pastille: "text-accent-text", icone: Wrench },
  BREAK: { rail: "bg-border", pastille: "text-text-3", icone: Coffee },
  LUNCH: { rail: "bg-border", pastille: "text-text-3", icone: Utensils },
  AWARDS: { rail: "bg-ansd-or", pastille: "text-gold-text", icone: Award },
  CLOSING: { rail: "bg-ansd-or", pastille: "text-gold-text", icone: Sparkles },
};

function minutes(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function heure(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}h${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function EtatBadge({ places }: { places: PlacesSession }) {
  if (places.etat === "SANS_RESERVATION") return null;
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[0.68rem] font-semibold ${COULEUR_ETAT[places.etat]}`}
    >
      {ETAT_LABELS[places.etat]}
      {places.etat === "OUVERTE" && places.restantes !== null && ` · ${places.restantes} places`}
    </span>
  );
}

function Carte({ session }: { session: SessionAffichable }) {
  const allure = ALLURE_TYPE[session.type];
  const Icone = allure.icone;

  return (
    <Link
      href={`/programme/${session.slug}`}
      className="border-border bg-surface hover:border-link carte-relief relative flex h-full flex-col gap-1 overflow-hidden rounded-lg border p-2.5 pl-3.5 no-underline"
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${allure.rail}`} />
      <span className="text-text-3 flex items-center gap-1.5 text-[0.7rem] font-semibold">
        <Clock aria-hidden size={11} className="shrink-0" />
        {heure(session.debut)} – {heure(session.fin)}
        <Icone aria-hidden size={11} className={`ml-0.5 shrink-0 ${allure.pastille}`} />
        <span className="truncate">{TYPE_LABELS[session.type]}</span>
      </span>
      <span className="text-heading titre-carte text-sm leading-snug font-semibold">
        {session.titre}
      </span>
      {session.theme && <span className="text-text-3 text-[0.7rem]">{session.theme}</span>}
      <span className="mt-auto pt-1">
        <EtatBadge places={session.places} />
      </span>
    </Link>
  );
}

/**
 * Grille jour × salle (brief §5.5).
 *
 * Les sessions sont posées sur une grille CSS dont les lignes valent une
 * demi-heure : une session de 90 minutes occupe trois lignes, et deux sessions
 * simultanées dans deux salles apparaissent côte à côte — c'est précisément ce
 * qu'un participant vient vérifier avant de choisir son panel.
 *
 * Les sessions **sans salle** (ouverture, pauses, déjeuner) barrent toute la
 * largeur : ce sont des moments communs, et les caler dans une colonne
 * laisserait croire qu'on peut faire autre chose pendant.
 *
 * Sous `md`, la grille cède la place à une liste chronologique : à cette largeur
 * quatre colonnes rendraient les titres illisibles, et une grille qu'il faut
 * faire défiler horizontalement ne se lit pas non plus.
 */
export function ProgrammeGrid({
  sessions,
  salles,
}: {
  sessions: SessionAffichable[];
  salles: { id: string; name: string }[];
}) {
  if (sessions.length === 0) {
    return <p className="text-text-2 text-sm">Aucune session ne correspond à ces filtres.</p>;
  }

  const debutJour = Math.min(...sessions.map((session) => minutes(session.debut)));
  const finJour = Math.max(...sessions.map((session) => minutes(session.fin)));
  const nbLignes = Math.max(Math.ceil((finJour - debutJour) / PAS_MINUTES), 1);

  const colonnes = salles.filter((salle) =>
    sessions.some((session) => session.salle?.id === salle.id),
  );

  const ligneDe = (date: Date) =>
    Math.max(Math.round((minutes(date) - debutJour) / PAS_MINUTES) + 1, 1);

  const reperes = Array.from({ length: nbLignes }, (_, index) => debutJour + index * PAS_MINUTES);

  return (
    <>
      {/* Grille — écrans larges */}
      <div className="hidden md:block">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `4.5rem repeat(${Math.max(colonnes.length, 1)}, minmax(0, 1fr))`,
            gridTemplateRows: `auto repeat(${nbLignes}, minmax(3.25rem, auto))`,
          }}
        >
          <div />
          {colonnes.map((salle) => (
            <div key={salle.id} className="text-text-3 pb-1 text-xs font-semibold">
              {salle.name}
            </div>
          ))}

          {reperes.map((repere, index) => (
            <div
              key={repere}
              className="text-text-3 border-border border-t pt-1 text-[0.7rem] tabular-nums"
              style={{ gridColumn: 1, gridRow: index + 2 }}
            >
              {String(Math.floor(repere / 60)).padStart(2, "0")}h
              {String(repere % 60).padStart(2, "0")}
            </div>
          ))}

          {sessions.map((session) => {
            const debut = ligneDe(session.debut);
            const fin = Math.max(ligneDe(session.fin), debut + 1);
            const colonne = session.salle
              ? colonnes.findIndex((salle) => salle.id === session.salle!.id) + 2
              : 2;

            return (
              <div
                key={session.id}
                style={{
                  gridRow: `${debut + 1} / ${fin + 1}`,
                  gridColumn: session.salle ? colonne : `2 / ${Math.max(colonnes.length, 1) + 2}`,
                }}
              >
                <Carte session={session} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Liste chronologique — écrans étroits */}
      <ul className="flex flex-col gap-2 md:hidden">
        {sessions.map((session) => (
          <li key={session.id}>
            <Carte session={session} />
            {session.salle && (
              <span className="text-text-3 mt-1 block text-[0.7rem]">{session.salle.name}</span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
