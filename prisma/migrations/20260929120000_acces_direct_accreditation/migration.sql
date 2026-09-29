-- Accès direct à « Mon espace » depuis l'e-mail de confirmation, et
-- accréditation presse (29 septembre 2026).

-- Catégories soumises à accréditation : la presse.
ALTER TABLE `ParticipantCategory` ADD COLUMN `requiresAccreditation` BOOLEAN NOT NULL DEFAULT false;
UPDATE `ParticipantCategory` SET `requiresAccreditation` = true WHERE `code` = 'MEDIA';

ALTER TABLE `Participant` ADD COLUMN `accreditedAt` DATETIME(3) NULL;

-- Confirmation : lien d'accès direct et code de secours. Mise à jour
-- conditionnée au texte d'origine — un modèle retouché en BackOffice n'est
-- pas écrasé (sa variable {{lien_espace}} mène désormais, elle aussi, droit
-- dans l'espace).
UPDATE `NotificationTemplate`
SET `bodyFr` = 'Bonjour {{prenom}},\n\nVotre participation au Forum international sur les données est confirmée.\n\nAccédez directement à votre espace, sans autre démarche : {{lien_espace}}\nCe lien vous est personnel ; il reste valable 14 jours.\n\nCode d''accès de secours, à saisir avec votre adresse e-mail sur la page « Mon espace » : {{code6}}\n{{referent_bloc}}\n\nCordialement,\nLe comité d''organisation',
    `variables` = JSON_ARRAY('prenom', 'lien_espace', 'code6', 'referent_bloc')
WHERE `key` = 'registration_confirmed' AND `bodyFr` = 'Bonjour {{prenom}},\n\nVotre participation au Forum international sur les données est confirmée. Retrouvez vos informations dans votre espace : {{lien_espace}}\n{{referent_bloc}}\n\nCordialement,\nLe comité d''organisation';

UPDATE `NotificationTemplate`
SET `bodyEn` = 'Hello {{prenom}},\n\nYour participation in the International Data Forum is confirmed.\n\nGo straight to your personal space, with no further step: {{lien_espace}}\nThis link is personal and remains valid for 14 days.\n\nBackup access code, to enter with your e-mail address on the "My space" page: {{code6}}\n{{referent_bloc}}\n\nBest regards,\nThe organising committee'
WHERE `key` = 'registration_confirmed' AND `bodyEn` = 'Hello {{prenom}},\n\nYour participation in the International Data Forum is confirmed. Find your details in your personal space: {{lien_espace}}\n{{referent_bloc}}\n\nBest regards,\nThe organising committee';

-- Nouveaux modèles, pour chaque édition qui ne les a pas encore.
INSERT INTO `NotificationTemplate` (`id`, `editionId`, `key`, `channel`, `subjectFr`, `subjectEn`, `bodyFr`, `bodyEn`, `variables`, `createdAt`, `updatedAt`)
SELECT CONCAT('tpl', REPLACE(UUID(), '-', '')), e.`id`, 'accreditation_pending', 'EMAIL',
       'Votre demande d''accréditation presse est bien reçue',
       'Your press accreditation request has been received',
       'Bonjour {{prenom}},\n\nNous avons bien reçu votre demande d''accréditation presse pour le Forum international sur les données.\n\nVotre compte sera activé dès que l''administration du Forum aura accordé votre accréditation. Vous recevrez alors un e-mail avec un accès direct à votre espace, où vous retrouverez votre badge presse.\n\nCordialement,\nLe comité d''organisation',
       'Hello {{prenom}},\n\nWe have received your press accreditation request for the International Data Forum.\n\nYour account will be activated as soon as the Forum administration has granted your accreditation. You will then receive an e-mail with direct access to your personal space, where your press badge will be available.\n\nBest regards,\nThe organising committee',
       JSON_ARRAY('prenom'), NOW(3), NOW(3)
FROM `Edition` e
WHERE NOT EXISTS (
  SELECT 1 FROM `NotificationTemplate` t
  WHERE t.`editionId` = e.`id` AND t.`key` = 'accreditation_pending' AND t.`channel` = 'EMAIL'
);

INSERT INTO `NotificationTemplate` (`id`, `editionId`, `key`, `channel`, `subjectFr`, `subjectEn`, `bodyFr`, `bodyEn`, `variables`, `createdAt`, `updatedAt`)
SELECT CONCAT('tpl', REPLACE(UUID(), '-', '')), e.`id`, 'accreditation_granted', 'EMAIL',
       'Votre accréditation presse est accordée',
       'Your press accreditation has been granted',
       'Bonjour {{prenom}},\n\nVotre accréditation presse pour le Forum international sur les données est accordée : votre compte est activé.\n\nAccédez directement à votre espace : {{lien_espace}}\nCe lien vous est personnel ; il reste valable 14 jours.\n\nCode d''accès de secours, à saisir avec votre adresse e-mail sur la page « Mon espace » : {{code6}}\n\nVotre badge presse, qui porte la mention « Accréditation presse », y sera disponible dès sa génération.\n\nCordialement,\nLe comité d''organisation',
       'Hello {{prenom}},\n\nYour press accreditation for the International Data Forum has been granted: your account is now active.\n\nGo straight to your personal space: {{lien_espace}}\nThis link is personal and remains valid for 14 days.\n\nBackup access code, to enter with your e-mail address on the "My space" page: {{code6}}\n\nYour press badge, marked "Press accreditation", will be available there as soon as it is generated.\n\nBest regards,\nThe organising committee',
       JSON_ARRAY('prenom', 'lien_espace', 'code6'), NOW(3), NOW(3)
FROM `Edition` e
WHERE NOT EXISTS (
  SELECT 1 FROM `NotificationTemplate` t
  WHERE t.`editionId` = e.`id` AND t.`key` = 'accreditation_granted' AND t.`channel` = 'EMAIL'
);
