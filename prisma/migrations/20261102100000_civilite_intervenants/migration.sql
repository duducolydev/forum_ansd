-- Civilité des intervenants (2 novembre 2026).
--
-- Colonne facultative, vide à la création : aucune fiche existante n'est
-- modifiée. Sans civilité saisie, l'affichage reprend celle du participant lié.
ALTER TABLE `Speaker` ADD COLUMN `civility` VARCHAR(20) NULL;
