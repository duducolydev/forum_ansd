-- Couleur d'un niveau de partenariat, choisie en BackOffice (28 septembre 2026).
--
-- Le site n'affiche plus le nom du niveau (Gold, Silver…), seulement sa
-- couleur : le comité la règle donc lui-même, dans une liste fermée de teintes
-- mesurées (`modules/sponsors/palette.ts`). NULL = couleur déduite du libellé,
-- comme jusqu'ici : aucune installation existante ne change d'aspect.
ALTER TABLE `SponsorLevel` ADD COLUMN `color` VARCHAR(20) NULL;
