import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Scanner",
  manifest: "/scan.webmanifest",
  /*
   * iOS ignore les icônes du manifeste et lit `apple-touch-icon` ; sans elle,
   * l'écran d'accueil montre une capture réduite de la page. Les icônes Android
   * sont déclarées dans le manifeste (PLAN.md §16.7).
   */
  icons: { apple: "/icons/scan-apple-180.png" },
  // Ouvert depuis l'écran d'accueil d'un iPhone ou d'un iPad : plein écran, sans
  // la barre de Safari.
  appleWebApp: { capable: true, title: "Scanner Forum", statusBarStyle: "black-translucent" },
  // Une application de contrôle d'accès n'a rien à faire dans un index.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0B1622",
  // Zoom bloqué : l'agent tient l'appareil d'une main et vise un badge de
  // l'autre ; un pincement involontaire au milieu d'une file est une gêne.
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function ScannerLayout({ children }: { children: ReactNode }) {
  return children;
}
