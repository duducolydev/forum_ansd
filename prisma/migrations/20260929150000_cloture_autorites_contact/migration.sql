-- 29 septembre 2026 : cérémonie de clôture, catégorie « Autorités
-- administratives », modèle du formulaire de contact.

-- Jours de participation : la cérémonie de clôture remplace la conférence
-- inaugurale dans le formulaire. L'ancienne colonne est conservée pour les
-- réponses déjà données : ce n'est pas le même moment, rien à convertir.
ALTER TABLE `Participant` ADD COLUMN `attendsClosing` BOOLEAN NOT NULL DEFAULT false;

-- Nouvelle catégorie, sur le modèle d'« Autorité / VIP » (validation par le
-- comité, logistique, scan orange), pour chaque édition qui ne l'a pas.
INSERT INTO `ParticipantCategory` (`id`, `editionId`, `code`, `labelFr`, `labelEn`, `color`, `autoConfirm`, `requiresLogistics`, `alertOnScan`, `requiresAccreditation`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`)
SELECT CONCAT('cat', REPLACE(UUID(), '-', '')), e.`id`, 'AUTORITE_ADMIN', 'Autorités administratives', 'Administrative authorities', '#6D4C9F', false, true, true, false, 15, true, NOW(3), NOW(3)
FROM `Edition` e
WHERE NOT EXISTS (SELECT 1 FROM `ParticipantCategory` c WHERE c.`editionId` = e.`id` AND c.`code` = 'AUTORITE_ADMIN');

-- Mêmes zones d'accès que les autorités / VIP de la même édition.
INSERT INTO `CategoryZone` (`id`, `categoryId`, `zoneId`)
SELECT CONCAT('cz', REPLACE(UUID(), '-', '')), admin.`id`, cz.`zoneId`
FROM `ParticipantCategory` admin
JOIN `ParticipantCategory` vip ON vip.`editionId` = admin.`editionId` AND vip.`code` = 'AUTORITE_VIP'
JOIN `CategoryZone` cz ON cz.`categoryId` = vip.`id`
WHERE admin.`code` = 'AUTORITE_ADMIN'
  AND NOT EXISTS (SELECT 1 FROM `CategoryZone` x WHERE x.`categoryId` = admin.`id` AND x.`zoneId` = cz.`zoneId`);

-- Accréditation presse : permission réservée à l'administration. Ajoutée
-- aux rôles qui la détiennent par défaut, s'ils ne l'ont pas déjà.
UPDATE `Role`
SET `permissions` = JSON_ARRAY_APPEND(`permissions`, '$', 'participants.accredit')
WHERE `name` IN ('SUPER_ADMIN', 'ADMIN_FORUM', 'GESTIONNAIRE_PARTICIPANTS')
  AND NOT JSON_CONTAINS(`permissions`, '"participants.accredit"');

-- Modèle du message envoyé au comité par le formulaire de contact.
INSERT INTO `NotificationTemplate` (`id`, `editionId`, `key`, `channel`, `subjectFr`, `subjectEn`, `bodyFr`, `bodyEn`, `variables`, `createdAt`, `updatedAt`)
SELECT CONCAT('tpl', REPLACE(UUID(), '-', '')), e.`id`, 'contact_message', 'EMAIL',
       '[Contact site] {{objet}}',
       '[Website contact] {{objet}}',
       'Nouveau message reçu par le formulaire de contact du site.\n\nDe : {{nom}} <{{email}}>\nOrganisation : {{organisation}}\nObjet : {{objet}}\n\n{{message}}\n\n—\nRépondez directement à ce message : la réponse part vers l''adresse de l''expéditeur.',
       'New message received through the website contact form.\n\nFrom: {{nom}} <{{email}}>\nOrganisation: {{organisation}}\nSubject: {{objet}}\n\n{{message}}\n\n—\nReply directly to this message: the answer goes to the sender''s address.',
       JSON_ARRAY('nom', 'email', 'organisation', 'objet', 'message'), NOW(3), NOW(3)
FROM `Edition` e
WHERE NOT EXISTS (
  SELECT 1 FROM `NotificationTemplate` t
  WHERE t.`editionId` = e.`id` AND t.`key` = 'contact_message' AND t.`channel` = 'EMAIL'
);
