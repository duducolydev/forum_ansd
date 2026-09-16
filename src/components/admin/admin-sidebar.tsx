"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ecrireEtatMenu, type EtatMenu } from "@/lib/sidebar";
import { utiliseLaCamera } from "@/lib/pages-camera";
import { menuPour, type NavGroup } from "./nav";
import { MenuUtilisateur } from "./menu-utilisateur";

/**
 * Navigation du BackOffice : repliable, en rubriques dépliables.
 *
 * L'état — menu réduit, rubriques fermées — est persisté en cookie et **lu par
 * le serveur** (`lib/sidebar-serveur.ts`), si bien que le premier rendu est déjà
 * dans le bon état, sans saut de mise en page à chaque navigation.
 *
 * Le cookie est écrit **dans le même geste** que l'état local, sans Server
 * Action : autrement, replier le menu puis cliquer aussitôt sur un lien
 * repartait avec l'ancienne valeur, l'écriture serveur étant encore en vol.
 *
 * La rubrique qui contient la page courante est toujours dépliée, quel que soit
 * le cookie : se retrouver sur un écran dont l'entrée de menu est cachée fait
 * perdre le fil de l'endroit où l'on est.
 */
export function AdminSidebar({
  userName,
  roleName,
  permissions,
  etatInitial,
}: {
  userName: string;
  roleName: string;
  permissions: readonly string[];
  etatInitial: EtatMenu;
}) {
  const chemin = usePathname();
  const [etat, setEtat] = useState<EtatMenu>(etatInitial);

  const groupes = menuPour(permissions);

  function enregistrer(suivant: EtatMenu) {
    setEtat(suivant);
    // Écriture synchrone : l'état local et le cookie changent dans le même
    // geste, si bien qu'une navigation immédiate part déjà avec la bonne valeur.
    ecrireEtatMenu(suivant);
  }

  function basculerRepli() {
    enregistrer({ ...etat, replie: !etat.replie });
  }

  function basculerRubrique(label: string) {
    const fermees = etat.fermees.includes(label)
      ? etat.fermees.filter((entree) => entree !== label)
      : [...etat.fermees, label];
    enregistrer({ ...etat, fermees });
  }

  /** Une entrée est active si le chemin courant est elle-même ou l'une de ses sous-pages. */
  function estActive(href: string): boolean {
    return chemin === href || chemin.startsWith(`${href}/`);
  }

  function contientLaPageCourante(groupe: NavGroup): boolean {
    return groupe.items.some((item) => estActive(item.href));
  }

  const replie = etat.replie;

  return (
    <aside
      data-replie={replie ? "true" : "false"}
      className={`border-dark-panel-line bg-dark-panel text-dark-panel-muted transition-tout sticky top-0 flex h-screen flex-col border-r py-4 ${
        replie ? "w-[68px] px-2" : "w-[236px] px-3.5"
      }`}
    >
      <div className={`mb-3 flex items-center ${replie ? "justify-center" : "justify-between"}`}>
        {!replie && (
          <Link href="/admin" className="flex items-center gap-2.5 px-1">
            <span
              aria-hidden
              className="bg-ansd-bleu-nuit grid h-8 w-8 grid-cols-3 items-end gap-[2px] rounded-lg p-[4px]"
            >
              <i className="block h-[40%] rounded-sm bg-[#7FB3E6]" />
              <i className="bg-ansd-vert-vif block h-[70%] rounded-sm" />
              <i className="block h-full rounded-sm bg-white" />
            </span>
            <b className="font-display text-[0.92rem] text-white">Forum ANSD</b>
          </Link>
        )}
        <button
          type="button"
          onClick={basculerRepli}
          aria-label={replie ? "Déplier le menu" : "Replier le menu"}
          title={replie ? "Déplier le menu" : "Replier le menu"}
          className="transition-tout text-dark-panel-muted grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-white/10 hover:text-white"
        >
          {replie ? (
            <PanelLeftOpen aria-hidden size={18} />
          ) : (
            <PanelLeftClose aria-hidden size={18} />
          )}
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto">
        {groupes.map((groupe) => {
          const ouvert =
            replie || !groupe.label
              ? true
              : !etat.fermees.includes(groupe.label) || contientLaPageCourante(groupe);
          const Rubrique = groupe.icone;

          return (
            <div key={groupe.label ?? "racine"} className={groupe.label ? "mt-1.5" : ""}>
              {groupe.label && !replie && (
                <button
                  type="button"
                  onClick={() => basculerRubrique(groupe.label!)}
                  aria-expanded={ouvert}
                  className="transition-tout text-dark-panel-muted flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.7rem] font-semibold tracking-wide uppercase hover:text-white"
                >
                  {Rubrique && <Rubrique aria-hidden size={13} />}
                  <span className="flex-1 text-left">{groupe.label}</span>
                  <ChevronDown
                    aria-hidden
                    size={14}
                    className={`transition-transform ${ouvert ? "" : "-rotate-90"}`}
                  />
                </button>
              )}

              {/* Séparateur discret quand le menu est réduit : sans les
                  intitulés, les rubriques se confondraient en une seule liste. */}
              {groupe.label && replie && <div className="bg-dark-panel-line mx-2 my-1.5 h-px" />}

              {ouvert &&
                groupe.items.map((item) => {
                  const Icone = item.icone;
                  const active = estActive(item.href);
                  const classes = `transition-tout group relative flex items-center gap-2.5 rounded-lg py-2.5 text-[0.88rem] ${
                    replie ? "justify-center px-0" : "px-2.5"
                  } ${
                    active
                      ? "bg-white/12 font-semibold text-white"
                      : "text-dark-panel-muted hover:bg-white/8 hover:text-white"
                  }`;

                  const contenu = (
                    <>
                      {/* Repère de position, en plus de la couleur : un état
                          signalé par la seule teinte échappe à qui la distingue mal. */}
                      {active && (
                        <span
                          aria-hidden
                          className="bg-ansd-vert-vif absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r"
                        />
                      )}
                      <Icone
                        aria-hidden
                        size={17}
                        strokeWidth={active ? 2.4 : 2}
                        className="transition-tout shrink-0 group-hover:scale-110"
                      />
                      {!replie && <span className="truncate">{item.label}</span>}
                    </>
                  );

                  /*
                   * Pages caméra (scanner, comptoir d'accueil) : lien ordinaire,
                   * donc **rechargement complet**. Une navigation interne garderait
                   * la `Permissions-Policy` du document courant, qui refuse la
                   * caméra — c'est ce qui rendait le scanner aveugle quand on
                   * l'ouvrait depuis ce menu (PLAN.md §16).
                   */
                  return utiliseLaCamera(item.href) ? (
                    <a
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={replie ? item.label : undefined}
                      className={classes}
                    >
                      {contenu}
                    </a>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={replie ? item.label : undefined}
                      className={classes}
                    >
                      {contenu}
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>

      <div className="border-dark-panel-line mt-3 border-t pt-3">
        <MenuUtilisateur userName={userName} roleName={roleName} replie={replie} />
      </div>
    </aside>
  );
}
