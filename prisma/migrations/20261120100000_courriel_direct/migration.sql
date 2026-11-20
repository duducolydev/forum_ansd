-- 20 novembre 2026 : « Suivez le Forum en direct », message aux inscrits que
-- le comité ne retiendra pas en salle.
--
-- La jauge du King Fahd Palace est finie, les demandes ne le sont pas. Un
-- inscrit dont le dossier n'aboutit pas n'a aujourd'hui aucune réponse : ce
-- message lui en donne une, et l'oriente vers la retransmission.
--
-- Aucun envoi automatique. Le modèle est destiné à « Envoi groupé », avec le
-- filtre de statut — c'est le comité qui décide du moment et du public, comme
-- pour `thank_you`.
--
-- Un ajout, aucun retrait : l'insertion ne se fait que si la clé est absente
-- de l'édition, de sorte qu'un rejeu de la migration ne duplique rien et
-- qu'un texte déjà retouché dans le BackOffice n'est jamais écrasé.

INSERT INTO `NotificationTemplate` (`id`, `editionId`, `key`, `channel`, `subjectFr`, `subjectEn`, `subjectPt`, `bodyFr`, `bodyEn`, `bodyPt`, `variables`, `createdAt`, `updatedAt`)
SELECT CONCAT('tpl', REPLACE(UUID(), '-', '')), e.`id`, 'live_announcement', 'EMAIL',
       'Suivez le Forum international sur les données en direct',
       'Follow the International Data Forum live',
       'Acompanhe o Fórum Internacional sobre Dados em direto',
       'Bonjour {{prenom}},\n\nNous avons bien reçu votre demande d''inscription au Forum international sur les données, et nous vous en remercions.\n\nLes places en salle sont en nombre limité et nous ne pouvons malheureusement pas répondre favorablement à toutes les demandes. Nous tenons cependant à ce que vous puissiez suivre les travaux : les trois journées sont retransmises en direct sur le portail du Forum, en accès libre et sans inscription.\n\n{{lien_direct}}\n\nLe programme détaillé des sessions est consultable ici : {{lien_programme}}\n\nLa page du direct affiche la session en cours et celle qui suit ; entre deux séances, elle annonce l''heure de reprise.\n\nMerci de l''intérêt que vous portez au Forum,\nLe comité d''organisation',
       'Hello {{prenom}},\n\nWe have received your registration request for the International Data Forum, and we thank you for it.\n\nSeating is limited and we are unfortunately unable to accept every request. We do, however, want you to be able to follow the proceedings: all three days are streamed live on the Forum portal, freely and without registration.\n\n{{lien_direct}}\n\nThe detailed programme of the sessions is available here: {{lien_programme}}\n\nThe live page shows the current session and the one coming up; between sessions, it announces the time of the next one.\n\nThank you for your interest in the Forum,\nThe organising committee',
       'Olá {{prenom}},\n\nRecebemos o seu pedido de inscrição no Fórum Internacional sobre Dados e agradecemos-lhe.\n\nOs lugares na sala são limitados e não nos é possível, infelizmente, dar resposta favorável a todos os pedidos. Fazemos questão, no entanto, de que possa acompanhar os trabalhos: os três dias são transmitidos em direto no portal do Fórum, em acesso livre e sem inscrição.\n\n{{lien_direct}}\n\nO programa detalhado das sessões pode ser consultado aqui: {{lien_programme}}\n\nA página do direto mostra a sessão em curso e a seguinte; entre duas sessões, anuncia a hora de regresso.\n\nObrigado pelo interesse que dedica ao Fórum,\nO comité organizador',
       JSON_ARRAY('prenom', 'lien_direct', 'lien_programme'), NOW(3), NOW(3)
FROM `Edition` e
WHERE NOT EXISTS (
  SELECT 1 FROM `NotificationTemplate` t
  WHERE t.`editionId` = e.`id` AND t.`key` = 'live_announcement' AND t.`channel` = 'EMAIL'
);
