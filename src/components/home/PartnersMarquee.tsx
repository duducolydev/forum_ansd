"use client";

import { useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";

export interface PartenaireBandeau {
  id: string;
  nom: string;
  logo: string | null;
  site: string | null;
  /** Classes du dégradé de la couleur du niveau (`palette.ts`), pour le liseré. */
  filet: string;
}

/**
 * Partenaires en double bandeau (brief §4.5) : deux rangées en sens opposés
 * (40 s et 48 s), fondu sur les bords, pause au survol, au focus clavier et
 * par le bouton « Mettre en pause » (WCAG 2.2.2).
 *
 * Cartes : logo réel, nom, liseré haut à la couleur du niveau. **Aucun
 * libellé de niveau** (Gold, Silver…) : arbitrage du 28 septembre 2026, qui
 * prime sur le brief ; la couleur et l'ordre se règlent en BackOffice.
 *
 * Chaque rangée porte la liste deux fois pour boucler sans à-coup. Seule la
 * première liste de la première rangée est lue par les lecteurs d'écran et
 * parcourue au clavier ; les copies sont `inert`. Sous mouvement réduit, plus
 * de défilement automatique : une bande que l'on fait défiler soi-même.
 */
/** Cartes par demi-rangée, au moins : en dessous, la boucle laisserait un trou. */
const MINIMUM = 8;

export function PartnersMarquee({
  partenaires,
  libelle,
}: {
  partenaires: PartenaireBandeau[];
  /** Nom de la liste pour les lecteurs d'écran. */
  libelle: string;
}) {
  const t = useTranslations("constellation.partners");
  const [pause, setPause] = useState(false);

  const cartes = (liste: PartenaireBandeau[]) =>
    liste.map((partenaire) => <CartePartenaire key={partenaire.id} partenaire={partenaire} />);
  const inverse = [...partenaires].reverse();
  // Nombre de copies par demi-rangée pour atteindre le minimum.
  const repetitions = Math.max(1, Math.ceil(MINIMUM / Math.max(1, partenaires.length)));
  const copies = (liste: PartenaireBandeau[], nombre: number, depart = 0) =>
    Array.from({ length: nombre }, (_, rang) => <Copie key={depart + rang}>{cartes(liste)}</Copie>);

  return (
    <div>
      <div className="bandeau-partenaires" data-pause={pause ? "" : undefined}>
        <Rang>
          <ul aria-label={libelle} className="flex gap-[1.4rem] pr-[1.4rem]">
            {cartes(partenaires)}
          </ul>
          {copies(partenaires, repetitions * 2 - 1)}
        </Rang>
        <Rang inverse>{copies(inverse, repetitions * 2)}</Rang>
      </div>

      <div className="mx-auto flex max-w-[1200px] justify-end px-6">
        <button
          type="button"
          // Le libellé change avec l'état : un `aria-pressed` en plus ferait
          // annoncer « Reprendre, activé », qui se contredit.
          onClick={() => setPause((valeur) => !valeur)}
          className="bandeau-partenaires__commande mt-5 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.95rem] font-medium text-[var(--muted)] hover:text-[var(--title)]"
        >
          {pause ? <Play aria-hidden size={15} /> : <Pause aria-hidden size={15} />}
          {pause ? t("resume") : t("pause")}
        </button>
      </div>
    </div>
  );
}

function Rang({ children, inverse = false }: { children: ReactNode; inverse?: boolean }) {
  return (
    <div
      className={`bandeau-partenaires__rang ${inverse ? "bandeau-partenaires__rang--inverse" : ""}`}
    >
      {children}
    </div>
  );
}

function Copie({ children }: { children: ReactNode }) {
  return (
    <ul aria-hidden inert className="bandeau-partenaires__copie flex gap-[1.4rem] pr-[1.4rem]">
      {children}
    </ul>
  );
}

function CartePartenaire({ partenaire }: { partenaire: PartenaireBandeau }) {
  const contenu = (
    <>
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${partenaire.filet}`}
      />
      <span className="carte-partenaire__logo">
        {partenaire.logo ? (
          /* eslint-disable-next-line @next/next/no-img-element -- logo servi par une route contrôlée, proportions variables : contenu, jamais déformé */
          <img src={partenaire.logo} alt="" className="max-h-16 max-w-full object-contain" />
        ) : (
          partenaire.nom
        )}
      </span>
      <span className="carte-partenaire__nom truncate">{partenaire.nom}</span>
    </>
  );

  return (
    <li className="shrink-0">
      {partenaire.site ? (
        <a
          href={partenaire.site}
          target="_blank"
          // `noopener` : la page ouverte ne doit pas pouvoir manipuler celle du
          // Forum via `window.opener`.
          rel="noopener noreferrer"
          className="carte-partenaire"
        >
          {contenu}
        </a>
      ) : (
        <div className="carte-partenaire">{contenu}</div>
      )}
    </li>
  );
}
