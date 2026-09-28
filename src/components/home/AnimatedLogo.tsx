"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";
import Image from "next/image";
import { LOGO_FORUM } from "@/components/site/logo-forum";
import {
  mouvementReduit,
  pointeurPrecis,
  useInView,
  usePrefersReducedMotion,
} from "@/components/motion/hooks";

/**
 * Grand logo du bandeau d'accueil (brief §4.1).
 *
 * - `animated` : **reconstruction** en SVG du logo officiel — globe aux
 *   méridiens qui tournent, Afrique qui se trace puis se remplit, point doré
 *   sur Dakar, arc tricolore, quatre barres, orbite de données, mot-symbole
 *   qui monte ligne à ligne.
 * - `official` : le fichier du logo officiel, avec les mêmes halo, ondes,
 *   flottement et parallaxe.
 *
 * Le choix se fait en BackOffice, sur la section du bandeau : c'est à la
 * communication de l'ANSD de trancher (brief).
 *
 * Décoratif (`aria-hidden`) : le `h1` du bandeau porte déjà le nom du Forum,
 * qu'un lecteur d'écran lirait deux fois.
 *
 * Parallaxe : au survol du bandeau, chaque calque se déplace d'une amplitude
 * différente (orbite −14, arc −8, globe +6, barres +18 px), par `--px` et
 * `--py` — souris seulement, jamais sous mouvement réduit.
 */
export function AnimatedLogo({ variant = "animated" }: { variant?: "animated" | "official" }) {
  const ref = useRef<HTMLDivElement>(null);
  const refMeridiens = useRef<SVGGElement>(null);
  const reduit = usePrefersReducedMotion();
  const visible = useInView(ref);
  const id = useId().replace(/:/g, "");

  /* Parallaxe, suivie sur toute la section du bandeau. */
  useEffect(() => {
    const logo = ref.current;
    const zone = logo?.closest("section");
    if (!logo || !zone || mouvementReduit() || !pointeurPrecis()) return;
    const borner = (v: number) => Math.max(-1, Math.min(1, v));
    function suivre(evenement: PointerEvent) {
      const cadre = logo!.getBoundingClientRect();
      logo!.style.setProperty(
        "--px",
        String(borner((evenement.clientX - (cadre.left + cadre.width / 2)) / cadre.width)),
      );
      logo!.style.setProperty(
        "--py",
        String(borner((evenement.clientY - (cadre.top + cadre.height / 2)) / cadre.height)),
      );
    }
    function relacher() {
      logo!.style.setProperty("--px", "0");
      logo!.style.setProperty("--py", "0");
    }
    zone.addEventListener("pointermove", suivre as EventListener);
    zone.addEventListener("pointerleave", relacher);
    return () => {
      zone.removeEventListener("pointermove", suivre as EventListener);
      zone.removeEventListener("pointerleave", relacher);
    };
  }, []);

  /* Méridiens qui tournent : rx = 78·|cos φ|. En pause hors écran. */
  useEffect(() => {
    const groupe = refMeridiens.current;
    if (!groupe || variant !== "animated") return;
    const ellipses = [...groupe.querySelectorAll("ellipse")];
    function poser(temps: number) {
      ellipses.forEach((ellipse, k) => {
        const phase = temps / 2600 + (k * Math.PI) / 6;
        ellipse.setAttribute("rx", (Math.abs(Math.cos(phase)) * 78).toFixed(2));
        ellipse.setAttribute(
          "stroke-opacity",
          (0.35 + 0.65 * Math.abs(Math.sin(phase))).toFixed(2),
        );
      });
    }
    if (reduit || !visible) {
      if (reduit) poser(0);
      return;
    }
    let image = 0;
    function boucle(temps: number) {
      poser(temps);
      image = requestAnimationFrame(boucle);
    }
    image = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(image);
  }, [reduit, visible, variant]);

  const delai = (s: number) => ({ "--dl": `${s}s` }) as CSSProperties;

  return (
    <div ref={ref} aria-hidden className="grand-logo">
      <div
        className={`grand-logo__scene ${variant === "official" ? "grand-logo__scene--officiel" : ""}`}
      >
        <div className="grand-logo__halo" />
        <div className="grand-logo__onde" />
        <div className="grand-logo__onde grand-logo__onde--2" />

        {variant === "official" ? (
          <div className="calque calque-globe relative flex h-full items-center">
            <Image
              src={LOGO_FORUM.src}
              alt=""
              width={LOGO_FORUM.largeur}
              height={LOGO_FORUM.hauteur}
              unoptimized
              priority
              className="plaque-logo h-auto w-full"
            />
          </div>
        ) : (
          <svg className="grand-logo__svg" viewBox="0 0 250 250">
            <defs>
              <radialGradient id={`${id}-globe`} cx="38%" cy="32%" r="75%">
                <stop offset="0" stopColor="#8cc4ff" />
                <stop offset=".45" stopColor="#2f6fc4" />
                <stop offset="1" stopColor="#0b2550" />
              </radialGradient>
              <radialGradient id={`${id}-ombre`} cx="72%" cy="75%" r="70%">
                <stop offset=".45" stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#000" stopOpacity=".45" />
              </radialGradient>
              <linearGradient id={`${id}-afrique`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7dd98f" />
                <stop offset="1" stopColor="#2f8a3e" />
              </linearGradient>
              <clipPath id={`${id}-clip`}>
                <circle cx="115" cy="130" r="78" />
              </clipPath>
            </defs>

            {/* Orbite de données */}
            <g className="calque calque-orbite">
              <path
                id={`${id}-orbite`}
                d="M13 130 A102 34 0 1 1 217 130 A102 34 0 1 1 13 130"
                transform="rotate(-18 115 130)"
                fill="none"
                stroke="#3b7dd8"
                strokeOpacity=".35"
                strokeWidth="1.2"
                strokeDasharray="3 5"
              />
            </g>

            {/* Globe */}
            <g className="calque calque-globe">
              <circle cx="115" cy="130" r="78" fill={`url(#${id}-globe)`} />
              <g
                clipPath={`url(#${id}-clip)`}
                fill="none"
                stroke="#fff"
                strokeOpacity=".2"
                strokeWidth="1"
              >
                <g ref={refMeridiens}>
                  {[0, 1, 2, 3, 4, 5].map((k) => (
                    <ellipse
                      key={k}
                      cx="115"
                      cy="130"
                      ry="78"
                      rx={(Math.abs(Math.cos((k * Math.PI) / 6)) * 78).toFixed(2)}
                    />
                  ))}
                </g>
                <ellipse cx="115" cy="78" rx="58" ry="6" />
                <ellipse cx="115" cy="104" rx="74" ry="8" />
                <ellipse cx="115" cy="130" rx="78" ry="9" />
                <ellipse cx="115" cy="156" rx="74" ry="8" />
                <ellipse cx="115" cy="182" rx="58" ry="6" />
              </g>
              <path
                className="afrique"
                pathLength={1}
                fill={`url(#${id}-afrique)`}
                stroke="#e9fff0"
                strokeWidth="1.6"
                strokeLinejoin="round"
                d="M88 72 C96 67 104 65 112 66 C122 67 131 68 138 70 C142 75 145 79 147 84 C150 91 153 96 157 100 C161 101 164 101 166 102 C164 108 161 112 158 116 C154 123 151 129 149 135 C147 143 146 150 141 158 C136 167 131 176 125 182 C121 186 117 187 113 184 C110 179 109 172 107 164 C105 155 104 146 101 138 C99 131 98 126 96 121 C94 117 90 115 84 114 C78 113 73 113 68 110 C63 107 60 103 58 97 C57 91 59 86 63 81 C70 76 79 74 88 72 Z"
              />
              {/* Madagascar */}
              <ellipse
                cx="161"
                cy="158"
                rx="4"
                ry="10"
                transform="rotate(20 161 158)"
                fill="#4cb46a"
                className="dakar"
              />
              {/* Dakar, point doré pulsant */}
              <g className="dakar">
                <circle cx="60" cy="97" r="3.4" fill="#e8b931" />
                {!reduit && (
                  <circle cx="60" cy="97" r="3.4" fill="none" stroke="#e8b931" strokeWidth="1.5">
                    <animate attributeName="r" values="3.4;14" dur="2s" repeatCount="indefinite" />
                    <animate
                      attributeName="opacity"
                      values="1;0"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
              <circle cx="115" cy="130" r="78" fill={`url(#${id}-ombre)`} />
              <ellipse
                cx="88"
                cy="92"
                rx="26"
                ry="14"
                fill="#fff"
                opacity=".18"
                transform="rotate(-30 88 92)"
              />
            </g>

            {/* Arc tricolore */}
            <g className="calque calque-arc" fill="none" strokeLinecap="round">
              <path
                className="trace-entree"
                style={delai(0.9)}
                pathLength={1}
                d="M145.8 214.6 A90 90 0 0 1 63.4 56.3"
                stroke="#2f8a3e"
                strokeWidth="5"
              />
              <path
                className="trace-entree"
                style={delai(1.05)}
                pathLength={1}
                d="M148.5 222.1 A98 98 0 0 1 58.8 49.7"
                stroke="#e8b931"
                strokeWidth="5"
              />
              <path
                className="trace-entree"
                style={delai(1.2)}
                pathLength={1}
                d="M151.3 229.6 A106 106 0 0 1 54.2 43.2"
                stroke="#d64541"
                strokeWidth="5"
              />
              <path
                className="reflet-arc"
                pathLength={1}
                d="M148.5 222.1 A98 98 0 0 1 58.8 49.7"
                stroke="#fff"
                strokeWidth="3"
              />
            </g>

            {/* Barres statistiques */}
            <g className="calque calque-barres">
              <rect
                className="barre-logo"
                style={delai(1.3)}
                x="160"
                y="50"
                width="10"
                height="24"
                rx="2"
                fill="#4cb46a"
              />
              <rect
                className="barre-logo"
                style={{ ...delai(1.42), animationDuration: ".9s, 2.2s" }}
                x="174"
                y="36"
                width="10"
                height="38"
                rx="2"
                fill="#e8b931"
              />
              <rect
                className="barre-logo"
                style={{ ...delai(1.54), animationDuration: ".9s, 2.9s" }}
                x="188"
                y="22"
                width="10"
                height="52"
                rx="2"
                fill="#d64541"
              />
              <rect
                className="barre-logo"
                style={{ ...delai(1.66), animationDuration: ".9s, 2.4s" }}
                x="202"
                y="6"
                width="10"
                height="68"
                rx="2"
                fill="#3b7dd8"
              />
            </g>

            {/* Paquets de données en orbite */}
            {!reduit && (
              <g className="calque calque-orbite">
                <circle r="4.5" fill="#e8b931">
                  <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
                    <mpath href={`#${id}-orbite`} />
                  </animateMotion>
                </circle>
                <circle r="3.5" fill="#4cb46a">
                  <animateMotion dur="7s" begin="-2.3s" repeatCount="indefinite">
                    <mpath href={`#${id}-orbite`} />
                  </animateMotion>
                </circle>
                <circle r="3" fill="#d64541">
                  <animateMotion dur="7s" begin="-4.6s" repeatCount="indefinite">
                    <mpath href={`#${id}-orbite`} />
                  </animateMotion>
                </circle>
              </g>
            )}
          </svg>
        )}
      </div>

      {variant === "animated" && (
        <div className="mot-symbole">
          <span className="mot-symbole__ligne">
            <span className="mot-symbole__forum" style={delai(1.6)}>
              F<span className="mot-symbole__o">O</span>RUM
            </span>
          </span>
          <span className="mot-symbole__ligne">
            <span className="mot-symbole__sous" style={delai(1.75)}>
              INTERNATIONAL
            </span>
          </span>
          <span className="mot-symbole__ligne">
            <span className="mot-symbole__sous" style={delai(1.9)}>
              SUR LES DONNÉES
            </span>
          </span>
          <span className="mot-symbole__tri">
            <i style={delai(2.1)} />
            <i style={delai(2.2)} />
            <i style={delai(2.3)} />
          </span>
          <span className="mot-symbole__ligne">
            <span className="mot-symbole__devise police-grotesk" style={delai(2.35)}>
              DONNÉES • INNOVATION • IMPACT
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
