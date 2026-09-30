import type { Langue } from "@/lib/langue";
import { Fragment } from "react";
import type { PageSection } from "@prisma/client";
import { WaveDivider } from "@/components/motion/WaveDivider";
import type { DonneesSections } from "../donnees";
import { fondDeSection, RenduSection } from "./rendu-section";

/**
 * Suite des sections d'une page, avec un séparateur ondulé entre deux sections
 * de fonds différents (brief « Constellation » §3). Le premier porte le tracé
 * et ses trois points de données.
 *
 * Une section qui ne rend rien (liste vide) n'est pas encore connue ici : son
 * séparateur est posé quand même, entre deux fonds qui, eux, diffèrent bien.
 */
export function SectionsComposees({
  sections,
  donnees,
  locale,
}: {
  sections: PageSection[];
  donnees: DonneesSections;
  locale: Langue;
}) {
  let premier = true;

  return (
    <>
      {sections.map((section, rang) => {
        const suivante = sections[rang + 1];
        const dessus = fondDeSection(section);
        const dessous = suivante ? fondDeSection(suivante) : null;
        const vague = dessous !== null && dessous !== dessus;
        const points = vague && premier;
        if (vague) premier = false;

        return (
          <Fragment key={section.id}>
            <RenduSection section={section} donnees={donnees} locale={locale} />
            {vague && <WaveDivider dessus={dessus} dessous={dessous} points={points} />}
          </Fragment>
        );
      })}
    </>
  );
}
