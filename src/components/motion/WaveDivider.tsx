/**
 * Séparateur ondulé entre deux sections de fonds différents (brief §3) : deux
 * vagues qui défilent à des vitesses opposées. La première du site porte en
 * plus un tracé pointillé où voyagent trois points de données.
 *
 * Le fond du séparateur est celui de la section du dessus ; les vagues, celui
 * de la section du dessous. Décor seulement : `aria-hidden`, aucun événement.
 * Composant serveur, animation en CSS (et SMIL pour les points, retirés sous
 * mouvement réduit par la feuille de style).
 */
export function WaveDivider({
  dessus,
  dessous,
  points = false,
  basse = false,
}: {
  /** Couleur CSS de la section du dessus. */
  dessus: string;
  /** Couleur CSS de la section du dessous. */
  dessous: string;
  points?: boolean;
  /** Version basse, sous les bandeaux compacts des pages intérieures. */
  basse?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={basse ? "vague vague--basse" : "vague"}
      style={{ background: dessus, ["--vague" as string]: dessous }}
    >
      <svg viewBox="0 0 2880 110" preserveAspectRatio="none">
        <path className="v2" d="M0 60 Q360 10 720 60 T1440 60 T2160 60 T2880 60 V110 H0Z" />
      </svg>
      <svg viewBox="0 0 2880 110" preserveAspectRatio="none">
        <path className="v1" d="M0 70 Q360 110 720 70 T1440 70 T2160 70 T2880 70 V110 H0Z" />
      </svg>
      {points && (
        <svg className="trace" viewBox="0 0 1440 110" preserveAspectRatio="none">
          <defs>
            <linearGradient id="vague-degrade">
              <stop offset="0" stopColor="#2f8a3e" />
              <stop offset=".5" stopColor="#e8b931" />
              <stop offset="1" stopColor="#3b7dd8" />
            </linearGradient>
          </defs>
          <path
            id="vague-trace"
            d="M0 70 Q360 20 720 60 T1440 50"
            fill="none"
            stroke="url(#vague-degrade)"
            strokeWidth="1.5"
            strokeDasharray="4 8"
            opacity=".6"
          />
          <g className="vague__points">
            <circle r="4" fill="#2f8a3e">
              <animateMotion dur="6s" repeatCount="indefinite">
                <mpath href="#vague-trace" />
              </animateMotion>
            </circle>
            <circle r="3" fill="#e8b931">
              <animateMotion dur="6s" begin="2s" repeatCount="indefinite">
                <mpath href="#vague-trace" />
              </animateMotion>
            </circle>
            <circle r="3.5" fill="#3b7dd8">
              <animateMotion dur="6s" begin="4s" repeatCount="indefinite">
                <mpath href="#vague-trace" />
              </animateMotion>
            </circle>
          </g>
        </svg>
      )}
    </div>
  );
}
