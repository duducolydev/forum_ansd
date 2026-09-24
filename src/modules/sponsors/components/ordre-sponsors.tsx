"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { deplacerSponsorAction } from "../actions";

export interface SponsorOrdonnable {
  id: string;
  name: string;
  niveau: string;
  logoUrl: string | null;
  publie: boolean;
}

/**
 * Liste ordonnée des partenaires, avec déplacement (§32).
 *
 * Deux flèches plutôt qu'un glisser-déposer : l'ordre se règle une fois, à
 * quelques rangs près, et un glisser-déposer accessible au clavier et au
 * lecteur d'écran est un chantier à lui seul — pour un geste que le comité
 * fera trois fois dans l'année.
 *
 * Les flèches des extrémités sont désactivées plutôt que masquées : une
 * colonne dont les boutons apparaissent et disparaissent au fil des lignes se
 * lit comme un tableau irrégulier.
 */
export function OrdreSponsors({ sponsors }: { sponsors: SponsorOrdonnable[] }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  function deplacer(sponsorId: string, direction: "haut" | "bas") {
    startTransition(async () => {
      const resultat = await deplacerSponsorAction(sponsorId, direction);
      if (resultat.erreur) {
        setErreur(resultat.erreur);
        return;
      }
      setErreur(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {erreur && <p className="text-danger-text text-sm">{erreur}</p>}

      <ol className="flex flex-col gap-2">
        {sponsors.map((sponsor, rang) => (
          <li
            key={sponsor.id}
            className="border-border bg-surface flex items-center gap-3 rounded-xl border p-3"
          >
            <span className="text-text-3 w-6 shrink-0 text-center text-sm tabular-nums">
              {rang + 1}
            </span>

            <span className="bg-bg-2 grid h-11 w-16 shrink-0 place-items-center overflow-hidden rounded-lg">
              {sponsor.logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element -- servi par une route contrôlée, dimensions variables */
                <img
                  src={sponsor.logoUrl}
                  alt=""
                  className="max-h-9 max-w-[3.5rem] object-contain"
                />
              ) : (
                <span className="text-text-3 text-[0.6rem]">sans logo</span>
              )}
            </span>

            <span className="min-w-0 flex-1">
              <Link
                href={`/admin/sponsors/${sponsor.id}`}
                className="text-link block truncate font-semibold"
              >
                {sponsor.name}
              </Link>
              <span className="text-text-3 text-xs">
                {sponsor.niveau}
                {sponsor.publie ? "" : " · brouillon"}
              </span>
            </span>

            <span className="flex shrink-0 gap-1">
              <Bouton
                ton="discret"
                taille="petit"
                icone={ChevronUp}
                aria-label={`Monter ${sponsor.name}`}
                disabled={enCours || rang === 0}
                onClick={() => deplacer(sponsor.id, "haut")}
              />
              <Bouton
                ton="discret"
                taille="petit"
                icone={ChevronDown}
                aria-label={`Descendre ${sponsor.name}`}
                disabled={enCours || rang === sponsors.length - 1}
                onClick={() => deplacer(sponsor.id, "bas")}
              />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
