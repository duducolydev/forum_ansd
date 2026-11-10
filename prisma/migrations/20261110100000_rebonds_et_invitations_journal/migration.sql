-- Historique d'envoi : invitations et rebonds différés (10 novembre 2026).
--
-- Ajouts seulement. `participantId` devient facultatif : un e-mail
-- d'invitation part vers une personne qui n'est pas encore participante, et
-- n'était jusqu'ici consigné nulle part. Les lignes existantes gardent leur
-- participant ; aucune n'est réécrite.

-- AlterTable
ALTER TABLE `NotificationLog` ADD COLUMN `bounceMessageId` VARCHAR(191) NULL,
    ADD COLUMN `bouncedAt` DATETIME(3) NULL,
    ADD COLUMN `invitationId` VARCHAR(191) NULL,
    MODIFY `participantId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `NotificationLog_bounceMessageId_key` ON `NotificationLog`(`bounceMessageId`);

-- CreateIndex
CREATE INDEX `NotificationLog_invitationId_idx` ON `NotificationLog`(`invitationId`);

-- CreateIndex
CREATE INDEX `NotificationLog_providerMessageId_idx` ON `NotificationLog`(`providerMessageId`);

-- CreateIndex
CREATE INDEX `NotificationLog_to_idx` ON `NotificationLog`(`to`);

-- AddForeignKey
ALTER TABLE `NotificationLog` ADD CONSTRAINT `NotificationLog_invitationId_fkey` FOREIGN KEY (`invitationId`) REFERENCES `Invitation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
