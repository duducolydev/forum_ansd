-- Ordre d'affichage des partenaires, décidé en BackOffice (demande du
-- commanditaire, 24 septembre 2026).
--
-- La page publique les groupait par niveau, ce qui imposait l'ordre du barème :
-- un partenaire institutionnel décisif passait après trois sponsors d'un
-- échelon supérieur. Le niveau redevient une mention sur la carte.

-- AlterTable
ALTER TABLE `Sponsor` ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Sponsor_editionId_sortOrder_idx` ON `Sponsor`(`editionId`, `sortOrder`);

-- Rang de départ repris du classement actuel du site : le rang du niveau,
-- multiplié pour laisser de la place entre deux échelons. Sans cela, tous les
-- partenaires porteraient zéro et la page les afficherait dans un ordre
-- arbitraire dès la mise à jour. Les partenaires d'un même niveau restent à
-- égalité, et c'est le nom qui les départage — comme aujourd'hui.
UPDATE `Sponsor` s
JOIN `SponsorLevel` l ON l.id = s.levelId
SET s.sortOrder = l.sortOrder * 100;
