-- Intervenants mis en avant sur l'accueil (brief « Constellation » §4.3).
-- Par défaut, personne : l'accueil montre alors les premiers par ordre
-- alphabétique, comme jusqu'ici.
ALTER TABLE `Speaker` ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `featuredOrder` INTEGER NOT NULL DEFAULT 0;
