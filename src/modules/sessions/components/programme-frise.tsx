"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, DoorOpen } from "lucide-react";
import { mouvementReduit } from "@/components/motion/hooks";
import { Reveal } from "@/components/motion/Reveal";
import { TYPE_LABELS } from "../schema";

export interface SessionFrise {
  id: string;
  slug: string;
  type: keyof typeof TYPE_LABELS;
  titre: string;
  theme: string | null;
  /** ISO. */
  debut: string;
  fin: string;
  salle: string | null;
  etat: string | null;
}

function heure(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getUTCHours()).padStart(2, "0")}h${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Programme d'une journée en frise verticale (brief « Constellation » §6),
 * dans les styles de la frise des actualités.
 *
 * Un créneau par heure de début ; le trait se remplit avec le défilement, le
 * point de chaque créneau s'allume en le franchissant, et les cartes de
 * session arrivent en cascade. **Pendant l'événement**, la session en cours
 * est mise en évidence (« En cours »), vérifiée chaque minute.
 *
 * Heures en UTC, qui est l'heure de Dakar : rien à convertir.
 */
export function ProgrammeFrise({ sessions, en }: { sessions: SessionFrise[]; en: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const refEncre = useRef<SVGLineElement>(null);
  const [anime, setAnime] = useState(false);
  const [allumes, setAllumes] = useState<boolean[]>([]);
  const [maintenant, setMaintenant] = useState<number | null>(null);

  const creneaux = [...new Set(sessions.map((session) => session.debut))]
    .sort()
    .map((debut) => ({ debut, sessions: sessions.filter((session) => session.debut === debut) }));

  useEffect(() => {
    setMaintenant(Date.now());
    const minuterie = window.setInterval(() => setMaintenant(Date.now()), 60_000);
    return () => window.clearInterval(minuterie);
  }, []);

  useEffect(() => {
    const frise = ref.current;
    if (!frise || mouvementReduit()) return;
    setAnime(true);
    let image = 0;
    function mesurer() {
      image = 0;
      if (!frise) return;
      const cadre = frise.getBoundingClientRect();
      const part = Math.min(1, Math.max(0, (window.innerHeight * 0.6 - cadre.top) / cadre.height));
      refEncre.current?.setAttribute("y2", String(part * frise.offsetHeight));
      const etats = [...frise.querySelectorAll<HTMLElement>("[data-creneau]")].map(
        (entree) => entree.getBoundingClientRect().top < window.innerHeight * 0.62,
      );
      setAllumes((avant) =>
        avant.length === etats.length && avant.every((v, i) => v === etats[i]) ? avant : etats,
      );
    }
    function planifier() {
      if (!image) image = requestAnimationFrame(mesurer);
    }
    mesurer();
    window.addEventListener("scroll", planifier, { passive: true });
    window.addEventListener("resize", planifier);
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener("scroll", planifier);
      window.removeEventListener("resize", planifier);
    };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        {en ? "No session matches these filters." : "Aucune session ne correspond à ces filtres."}
      </p>
    );
  }

  return (
    <div ref={ref} className="frise frise--programme" data-animee={anime ? "" : undefined}>
      <svg aria-hidden className="frise__trait" preserveAspectRatio="none">
        <defs>
          <linearGradient id="frise-programme-degrade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f8a3e" />
            <stop offset=".5" stopColor="#e8b931" />
            <stop offset="1" stopColor="#d64541" />
          </linearGradient>
        </defs>
        <line className="frise__piste" x1="3" y1="0" x2="3" y2="100%" />
        <line
          ref={refEncre}
          className="frise__encre"
          style={{ stroke: "url(#frise-programme-degrade)" }}
          x1="3"
          y1="0"
          x2="3"
          y2={anime ? "0" : "100%"}
        />
      </svg>

      <ol>
        {creneaux.map((creneau, rang) => (
          <li
            key={creneau.debut}
            data-creneau
            data-allume={!anime || allumes[rang] ? "" : undefined}
            className="creneau"
          >
            <span aria-hidden className="frise__point" />
            <p className="creneau__heure police-grotesk">{heure(creneau.debut)}</p>
            <div className="creneau__sessions">
              {creneau.sessions.map((session, index) => {
                const enCours =
                  maintenant !== null &&
                  maintenant >= new Date(session.debut).getTime() &&
                  maintenant < new Date(session.fin).getTime();
                return (
                  <Reveal key={session.id} variant="up" delay={index * 0.08}>
                    <Link
                      href={`/programme/${session.slug}`}
                      className="carte-session"
                      data-en-cours={enCours ? "" : undefined}
                    >
                      <span className="carte-session__meta">
                        <Clock aria-hidden size={13} />
                        {heure(session.debut)} – {heure(session.fin)}
                        <span className="carte-session__type">{TYPE_LABELS[session.type]}</span>
                        {enCours && (
                          <span className="carte-session__direct">
                            <span aria-hidden className="point-direct" />
                            {en ? "Now" : "En cours"}
                          </span>
                        )}
                      </span>
                      <span className="carte-session__titre">{session.titre}</span>
                      <span className="carte-session__pied">
                        {session.salle && (
                          <span className="inline-flex items-center gap-1">
                            <DoorOpen aria-hidden size={13} />
                            {session.salle}
                          </span>
                        )}
                        {session.theme && <span>{session.theme}</span>}
                        {session.etat && <span className="font-semibold">{session.etat}</span>}
                      </span>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
