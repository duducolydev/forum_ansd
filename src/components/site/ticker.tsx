/**
 * Chiffres clés en direct (participants confirmés, etc.) : brief §5.1, calculés
 * en base et mis en cache 5 min — branché avec le module participants (PLAN.md 3.2).
 * Contenu statique pour l'instant (Lot 0 : chrome seulement).
 */
export function Ticker() {
  const items = [
    "Forum international sur les données",
    "CICAD Diamniadio · 23–25 novembre 2026",
    "Ouverture des inscriptions : 5 octobre 2026",
    "Traduction simultanée FR · EN",
  ];

  return (
    <div
      className="bg-ticker-bg text-ticker-text h-8 overflow-hidden text-[0.8rem] leading-8 font-semibold whitespace-nowrap"
      aria-hidden
    >
      <div className="motion-safe:animate-ticker inline-block pl-[100%]">
        {items.map((item) => (
          <span key={item} className="mr-12">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
