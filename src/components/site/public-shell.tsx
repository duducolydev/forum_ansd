import type { ReactNode } from "react";
import { Ticker } from "./ticker";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Ticker />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
