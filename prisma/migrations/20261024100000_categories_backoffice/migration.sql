-- 24 octobre 2026 : catégories de participants créées depuis le BackOffice.
--
-- Deux colonnes ajoutées, rien de réécrit :
-- - `isPublic` : la catégorie est proposée sur le formulaire public. Vrai par
--   défaut, donc chaque catégorie existante garde exactement son comportement ;
-- - `badgeMention` : mention imprimée en bande sur le badge, vide par défaut.
ALTER TABLE `ParticipantCategory` ADD COLUMN `badgeMention` VARCHAR(40) NULL,
    ADD COLUMN `isPublic` BOOLEAN NOT NULL DEFAULT true;
