-- 29 septembre 2026 : import de participants par fichier Excel.

-- Permission réservée à l'administration, ajoutée aux rôles qui la
-- détiennent par défaut, s'ils ne l'ont pas déjà.
UPDATE `Role`
SET `permissions` = JSON_ARRAY_APPEND(`permissions`, '$', 'participants.import')
WHERE `name` IN ('SUPER_ADMIN', 'ADMIN_FORUM', 'GESTIONNAIRE_PARTICIPANTS')
  AND NOT JSON_CONTAINS(`permissions`, '"participants.import"');

-- E-mail envoyé à chaque personne importée : inscrite par le comité, accès
-- direct à son espace et code de secours.
INSERT INTO `NotificationTemplate` (`id`, `editionId`, `key`, `channel`, `subjectFr`, `subjectEn`, `bodyFr`, `bodyEn`, `variables`, `createdAt`, `updatedAt`)
SELECT CONCAT('tpl', REPLACE(UUID(), '-', '')), e.`id`, 'registration_imported', 'EMAIL',
       'Votre inscription au Forum international sur les données',
       'Your registration for the International Data Forum',
       'Bonjour {{prenom}},\n\nSuite à la confirmation de votre participation, le comité d''organisation vous a inscrit(e) au Forum international sur les données. Vous n''avez aucune démarche d''inscription à faire.\n\nAccédez directement à votre espace : {{lien_espace}}\nCe lien vous est personnel ; il reste valable 14 jours.\n\nCode d''accès de secours, à saisir avec votre adresse e-mail sur la page « Mon espace » : {{code6}}\n\nDans votre espace, vous pourrez vérifier et compléter vos informations, ajouter votre photo et télécharger votre badge. Un e-mail vous préviendra dès que le badge sera prêt.\n{{referent_bloc}}\n\nCordialement,\nLe comité d''organisation',
       'Hello {{prenom}},\n\nFollowing the confirmation of your participation, the organising committee has registered you for the International Data Forum. There is no registration step left for you to complete.\n\nGo straight to your personal space: {{lien_espace}}\nThis link is personal and remains valid for 14 days.\n\nBackup access code, to enter with your e-mail address on the "My space" page: {{code6}}\n\nIn your space, you can check and complete your details, add your photo and download your badge. An e-mail will let you know as soon as the badge is ready.\n{{referent_bloc}}\n\nBest regards,\nThe organising committee',
       JSON_ARRAY('prenom', 'lien_espace', 'code6', 'referent_bloc'), NOW(3), NOW(3)
FROM `Edition` e
WHERE NOT EXISTS (
  SELECT 1 FROM `NotificationTemplate` t
  WHERE t.`editionId` = e.`id` AND t.`key` = 'registration_imported' AND t.`channel` = 'EMAIL'
);
