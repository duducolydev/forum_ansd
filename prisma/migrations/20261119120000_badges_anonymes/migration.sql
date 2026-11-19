-- 19 novembre 2026 : badges anonymes, le stock de secours du jour J.
--
-- Des cartes à remettre à qui se présente sans inscription — garde du corps,
-- chef de protocole, visiteur de passage. Elles portent un QR valide et se
-- scannent comme les autres ; elles n'ont simplement pas de porteur.
--
-- ## Pourquoi `participantId` devient nullable
--
-- La solution évidente — cinquante participants fictifs — a été écartée après
-- vérification. Ces fiches entreraient dans les requêtes d'envoi, qui
-- sélectionnent par statut sans notion de « faux » : une lettre d'information
-- partirait vers cinquante adresses inventées, en rebonds et en quota Gmail
-- consommé. Elles entreraient aussi dans les vingt-huit agrégats qui comptent
-- les inscrits, et en oublier un fausse un chiffre officiel.
--
-- Rendre la colonne nullable ne touche aucune ligne existante : les 303 badges
-- déjà émis gardent leur porteur, et la contrainte de clé étrangère reste
-- entière pour les valeurs non nulles.
--
-- Le chemin du scan y était déjà prêt : `ScanLog.participantId` est nullable
-- depuis l'origine et `marquerPresences` écarte les nuls. Un badge anonyme
-- scanne donc, laisse sa trace, et ne fait progresser le statut de personne.

ALTER TABLE `Badge` MODIFY COLUMN `participantId` VARCHAR(191) NULL;

ALTER TABLE `Badge` ADD COLUMN `anonymousRef` VARCHAR(191) NULL;
ALTER TABLE `Badge` ADD COLUMN `anonymousSeq` INTEGER NULL;
ALTER TABLE `Badge` ADD COLUMN `anonymousCategoryId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Badge_anonymousRef_key` ON `Badge`(`anonymousRef`);
CREATE INDEX `Badge_anonymousCategoryId_idx` ON `Badge`(`anonymousCategoryId`);

ALTER TABLE `Badge` ADD CONSTRAINT `Badge_anonymousCategoryId_fkey`
  FOREIGN KEY (`anonymousCategoryId`) REFERENCES `ParticipantCategory`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
