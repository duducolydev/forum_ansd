import type { ReactNode } from "react";

/** Toujours sombre, indépendamment du thème choisi ailleurs sur le site (brief §9 bis). */
export default function ScannerLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark" className="bg-bg text-text min-h-screen">
      {children}
    </div>
  );
}
