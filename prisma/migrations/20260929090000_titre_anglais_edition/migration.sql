-- Nom anglais du Forum, affiché sous le titre du bandeau d'accueil
-- (demande du 29 septembre 2026). Pré-rempli avec le nom déjà employé dans
-- les modèles d'e-mails anglais ; il se modifie en BackOffice (Paramètres →
-- Identité de l'édition).
ALTER TABLE `Edition` ADD COLUMN `titleEn` VARCHAR(191) NULL;

UPDATE `Edition`
SET `titleEn` = 'International Data Forum'
WHERE `titleEn` IS NULL AND `title` = 'Forum international sur les données';
