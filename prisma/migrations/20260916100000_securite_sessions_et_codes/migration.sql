-- Sécurité (PLAN.md §18).

-- Codes à 6 chiffres erronés saisis pour un lien magique : au 5e, le lien est annulé.
ALTER TABLE `MagicLink` ADD COLUMN `failedAttempts` INTEGER NOT NULL DEFAULT 0;

-- Version de session : l'incrémenter ferme toutes les sessions ouvertes du compte.
ALTER TABLE `User` ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0;
