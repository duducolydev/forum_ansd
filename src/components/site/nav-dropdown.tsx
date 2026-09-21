"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
}

/**
 * Menu déroulant de la barre de navigation.
 *
 * Ouverture au **clic** et non au survol : un menu qui ne s'ouvre qu'au survol
 * est inatteignable au doigt et pénible au clavier. Fermeture à l'Échap, au
 * clic à l'extérieur, à la perte de focus et au changement de page.
 */
export function NavDropdown({ label, links }: { label: string; links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const pathname = usePathname();

  const active = links.some((link) => pathname === link.href);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Le focus revient sur le déclencheur, sinon il retombe sur le <body>
      // et la navigation au clavier repart du début de la page.
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        className={`transition-tout text-ansd-bleu-nuit focus-visible:outline-ansd-bleu-nuit flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium whitespace-nowrap hover:bg-white/60 ${
          // Sur la barre bleu clair (PLAN.md §20), la rubrique courante se marque
          // par un fond éclairci.
          active || open ? "bg-white/60" : ""
        }`}
      >
        {label}
        <ChevronDown
          aria-hidden
          size={14}
          className={`transition-tout ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          id={menuId}
          className="border-border bg-bg apparait absolute top-full left-0 z-50 mt-1 flex min-w-[210px] flex-col gap-0.5 rounded-xl border p-1.5 shadow-lg"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`hover:bg-blue-soft hover:text-blue-text transition-tout rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
                pathname === link.href ? "text-blue-text" : "text-text-2"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
