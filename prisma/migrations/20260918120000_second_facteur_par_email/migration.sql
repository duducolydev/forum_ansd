-- Second facteur des comptes BackOffice par e-mail, en remplacement du TOTP (PLAN.md §23).

-- CreateTable
CREATE TABLE `AdminLoginChallenge` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `code6` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `failedAttempts` INTEGER NOT NULL DEFAULT 0,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `AdminLoginChallenge_tokenHash_key`(`tokenHash`),
    INDEX `AdminLoginChallenge_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminLoginChallenge` ADD CONSTRAINT `AdminLoginChallenge_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Modèle du message de validation, pour chaque édition déjà en base : le seed le
-- pose aussi, mais une base existante ne le rejoue pas, et sans ce modèle plus
-- personne ne peut se connecter au BackOffice.
INSERT IGNORE INTO `NotificationTemplate`
  (`id`, `editionId`, `key`, `channel`, `subjectFr`, `subjectEn`, `bodyFr`, `bodyEn`, `variables`, `createdAt`, `updatedAt`)
SELECT
  CONCAT('tpl-admin-login-', `id`),
  `id`,
  'admin_login_code',
  'EMAIL',
  'Votre code de connexion au BackOffice',
  'Your BackOffice sign-in code',
  'Bonjour {{nom}},\n\nVoici votre code de connexion au BackOffice du Forum, valable {{minutes}} minutes :\n\n{{code6}}\n\nVous pouvez aussi valider la connexion depuis ce lien : {{lien_validation}}\n\nSi vous n''êtes pas à l''origine de cette connexion, ignorez ce message et changez votre mot de passe.\n\nLe comité d''organisation',
  'Hello {{nom}},\n\nHere is your sign-in code for the Forum BackOffice, valid for {{minutes}} minutes:\n\n{{code6}}\n\nYou can also confirm the sign-in from this link: {{lien_validation}}\n\nIf you did not initiate this sign-in, ignore this message and change your password.\n\nThe organising committee',
  '["nom", "code6", "lien_validation", "minutes"]',
  NOW(3),
  NOW(3)
FROM `Edition`;
