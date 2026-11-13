-- 13 novembre 2026 : récapitulatif du programme dans les rappels, et alertes
-- de changement au programme.
--
-- Deux ajouts, aucun retrait :
--
-- 1. Les rappels J-7 et J-1 portent désormais `{{mes_panels}}` (les panels que
--    le destinataire a réservés) et `{{programme}}` (le programme détaillé).
--    Les deux sont résolus **à l'envoi**, pas à la programmation : un rappel
--    planifié trois semaines plus tôt annoncerait sinon des horaires périmés.
-- 2. Quatre modèles nouveaux pour les changements de programme — session
--    modifiée ou retirée, adressée aux inscrits ou aux intervenants.
--
-- Comme pour les migrations de modèles précédentes, chaque langue n'est
-- remplacée que si son texte est encore celui d'origine : un modèle retouché
-- dans le BackOffice n'est jamais écrasé.

-- ---------------------------------------------------------------------------
-- 1. Rappels : le récapitulatif s'insère avant la signature
-- ---------------------------------------------------------------------------

UPDATE `NotificationTemplate`
SET `bodyFr` = 'Bonjour {{prenom}},\n\nLe Forum international sur les données ouvre dans une semaine, du 23 au 25 novembre 2026 à l''Hôtel King Fahd Palace, à Dakar.\n\nPensez à télécharger votre badge avant de venir : le badge est obligatoire et vous sera demandé à l''entrée. Téléchargez-le dans votre espace : {{lien_espace}}\n\nLes panels que vous avez réservés :\n{{mes_panels}}\n\nLe programme détaillé des trois journées :\n{{programme}}\n\nÀ très bientôt,\nLe comité d''organisation'
WHERE `key` = 'reminder_j7' AND `channel` = 'EMAIL'
  AND `bodyFr` = 'Bonjour {{prenom}},\n\nLe Forum international sur les données ouvre dans une semaine, du 23 au 25 novembre 2026 à l''Hôtel King Fahd Palace, à Dakar.\n\nPensez à télécharger votre badge avant de venir : le badge est obligatoire et vous sera demandé à l''entrée. Téléchargez-le dans votre espace : {{lien_espace}}\n\nÀ très bientôt,\nLe comité d''organisation';

UPDATE `NotificationTemplate`
SET `bodyEn` = 'Hello {{prenom}},\n\nThe International Data Forum opens in one week, from 23 to 25 November 2026 at the King Fahd Palace Hotel in Dakar.\n\nPlease download your badge before you come: the badge is mandatory and will be checked at the entrance. Download it from your personal space: {{lien_espace}}\n\nThe panels you have booked:\n{{mes_panels}}\n\nThe detailed programme of the three days:\n{{programme}}\n\nSee you soon,\nThe organising committee'
WHERE `key` = 'reminder_j7' AND `channel` = 'EMAIL'
  AND `bodyEn` = 'Hello {{prenom}},\n\nThe International Data Forum opens in one week, from 23 to 25 November 2026 at the King Fahd Palace Hotel in Dakar.\n\nPlease download your badge before you come: the badge is mandatory and will be checked at the entrance. Download it from your personal space: {{lien_espace}}\n\nSee you soon,\nThe organising committee';

UPDATE `NotificationTemplate`
SET `bodyPt` = 'Olá {{prenom}},\n\nO Fórum Internacional sobre Dados abre dentro de uma semana, de 23 a 25 de novembro de 2026, no Hotel King Fahd Palace, em Dacar.\n\nDescarregue o seu crachá antes de vir: o crachá é obrigatório e será verificado à entrada. Descarregue-o no seu espaço pessoal: {{lien_espace}}\n\nOs painéis que reservou:\n{{mes_panels}}\n\nO programa detalhado dos três dias:\n{{programme}}\n\nAté breve,\nO comité organizador'
WHERE `key` = 'reminder_j7' AND `channel` = 'EMAIL'
  AND `bodyPt` = 'Olá {{prenom}},\n\nO Fórum Internacional sobre Dados abre dentro de uma semana, de 23 a 25 de novembro de 2026, no Hotel King Fahd Palace, em Dacar.\n\nDescarregue o seu crachá antes de vir: o crachá é obrigatório e será verificado à entrada. Descarregue-o no seu espaço pessoal: {{lien_espace}}\n\nAté breve,\nO comité organizador';

UPDATE `NotificationTemplate`
SET `bodyFr` = 'Bonjour {{prenom}},\n\nLe Forum international sur les données ouvre demain matin à l''Hôtel King Fahd Palace, à Dakar. L''accueil est ouvert dès 8 h.\n\nPrésentez le QR de votre badge à l''entrée, sur votre téléphone ou imprimé : {{lien_espace}}\n\nLes panels que vous avez réservés :\n{{mes_panels}}\n\nLe programme détaillé des trois journées :\n{{programme}}\n\nBonne journée,\nLe comité d''organisation'
WHERE `key` = 'reminder_j1' AND `channel` = 'EMAIL'
  AND `bodyFr` = 'Bonjour {{prenom}},\n\nLe Forum international sur les données ouvre demain matin à l''Hôtel King Fahd Palace, à Dakar. L''accueil est ouvert dès 8 h.\n\nPrésentez le QR de votre badge à l''entrée, sur votre téléphone ou imprimé : {{lien_espace}}\n\nBonne journée,\nLe comité d''organisation';

UPDATE `NotificationTemplate`
SET `bodyEn` = 'Hello {{prenom}},\n\nThe International Data Forum opens tomorrow morning at the King Fahd Palace Hotel in Dakar. The welcome desk opens at 8 a.m.\n\nShow your badge QR code at the entrance, on your phone or printed: {{lien_espace}}\n\nThe panels you have booked:\n{{mes_panels}}\n\nThe detailed programme of the three days:\n{{programme}}\n\nHave a good day,\nThe organising committee'
WHERE `key` = 'reminder_j1' AND `channel` = 'EMAIL'
  AND `bodyEn` = 'Hello {{prenom}},\n\nThe International Data Forum opens tomorrow morning at the King Fahd Palace Hotel in Dakar. The welcome desk opens at 8 a.m.\n\nShow your badge QR code at the entrance, on your phone or printed: {{lien_espace}}\n\nHave a good day,\nThe organising committee';

UPDATE `NotificationTemplate`
SET `bodyPt` = 'Olá {{prenom}},\n\nO Fórum Internacional sobre Dados abre amanhã de manhã no Hotel King Fahd Palace, em Dacar. O balcão de acolhimento abre às 8h00.\n\nApresente o código QR do seu crachá à entrada, no telemóvel ou impresso: {{lien_espace}}\n\nOs painéis que reservou:\n{{mes_panels}}\n\nO programa detalhado dos três dias:\n{{programme}}\n\nTenha um bom dia,\nO comité organizador'
WHERE `key` = 'reminder_j1' AND `channel` = 'EMAIL'
  AND `bodyPt` = 'Olá {{prenom}},\n\nO Fórum Internacional sobre Dados abre amanhã de manhã no Hotel King Fahd Palace, em Dacar. O balcão de acolhimento abre às 8h00.\n\nApresente o código QR do seu crachá à entrada, no telemóvel ou impresso: {{lien_espace}}\n\nTenha um bom dia,\nO comité organizador';

-- Les variables déclarées servent l'aide à la saisie du BackOffice, qui signale
-- sinon « 2 variable(s) non déclarée(s) » sur un modèle pourtant correct.
UPDATE `NotificationTemplate`
SET `variables` = JSON_ARRAY('prenom', 'lien_espace', 'mes_panels', 'programme')
WHERE `key` IN ('reminder_j7', 'reminder_j1') AND `channel` = 'EMAIL'
  AND `variables` = '["prenom", "lien_espace"]';

-- ---------------------------------------------------------------------------
-- 2. Changements au programme : quatre modèles nouveaux
-- ---------------------------------------------------------------------------
--
-- Deux publics séparés plutôt qu'un texte unique : un inscrit perd une séance
-- qu'il avait réservée, un intervenant perd un créneau qu'il avait préparé. Le
-- comité doit pouvoir retoucher l'un sans l'autre.

INSERT INTO `NotificationTemplate` (`id`, `editionId`, `key`, `channel`, `subjectFr`, `subjectEn`, `subjectPt`, `bodyFr`, `bodyEn`, `bodyPt`, `variables`, `createdAt`, `updatedAt`)
SELECT CONCAT('tpl', REPLACE(UUID(), '-', '')), e.`id`, 'session_updated', 'EMAIL',
       'Changement de programme : {{session}}',
       'Programme change: {{session}}',
       'Alteração do programa: {{session}}',
       'Bonjour {{prenom}},\n\nLa session « {{session}} », à laquelle vous êtes inscrit(e), vient d''être modifiée :\n\n{{changements}}\n\nLe détail de la session : {{lien_session}}\nVos réservations : {{lien_espace}}\n\nCordialement,\nLe comité d''organisation',
       'Hello {{prenom}},\n\nThe session "{{session}}", for which you are registered, has just been changed:\n\n{{changements}}\n\nSession details: {{lien_session}}\nYour bookings: {{lien_espace}}\n\nBest regards,\nThe organising committee',
       'Olá {{prenom}},\n\nA sessão «{{session}}», na qual está inscrito(a), acaba de ser alterada:\n\n{{changements}}\n\nDetalhes da sessão: {{lien_session}}\nAs suas reservas: {{lien_espace}}\n\nCom os melhores cumprimentos,\nO comité organizador',
       JSON_ARRAY('prenom', 'session', 'changements', 'lien_session', 'lien_espace'), NOW(3), NOW(3)
FROM `Edition` e
WHERE NOT EXISTS (
  SELECT 1 FROM `NotificationTemplate` t
  WHERE t.`editionId` = e.`id` AND t.`key` = 'session_updated' AND t.`channel` = 'EMAIL'
);

INSERT INTO `NotificationTemplate` (`id`, `editionId`, `key`, `channel`, `subjectFr`, `subjectEn`, `subjectPt`, `bodyFr`, `bodyEn`, `bodyPt`, `variables`, `createdAt`, `updatedAt`)
SELECT CONCAT('tpl', REPLACE(UUID(), '-', '')), e.`id`, 'session_updated_speaker', 'EMAIL',
       'Changement de programme : {{session}}',
       'Programme change: {{session}}',
       'Alteração do programa: {{session}}',
       'Bonjour {{prenom}},\n\nLa session « {{session}} », à laquelle vous participez comme intervenant(e), vient d''être modifiée :\n\n{{changements}}\n\nLe détail de la session : {{lien_session}}\nVotre espace intervenant : {{lien_espace}}\n\nSi ce créneau ne vous convient plus, répondez à ce message : le comité reprendra contact avec vous.\n\nCordialement,\nLe comité d''organisation',
       'Hello {{prenom}},\n\nThe session "{{session}}", in which you are taking part as a speaker, has just been changed:\n\n{{changements}}\n\nSession details: {{lien_session}}\nYour speaker space: {{lien_espace}}\n\nIf this slot no longer suits you, reply to this message and the committee will get back to you.\n\nBest regards,\nThe organising committee',
       'Olá {{prenom}},\n\nA sessão «{{session}}», na qual participa como orador(a), acaba de ser alterada:\n\n{{changements}}\n\nDetalhes da sessão: {{lien_session}}\nO seu espaço de orador: {{lien_espace}}\n\nSe este horário deixou de lhe convir, responda a esta mensagem e o comité entrará em contacto consigo.\n\nCom os melhores cumprimentos,\nO comité organizador',
       JSON_ARRAY('prenom', 'session', 'changements', 'lien_session', 'lien_espace'), NOW(3), NOW(3)
FROM `Edition` e
WHERE NOT EXISTS (
  SELECT 1 FROM `NotificationTemplate` t
  WHERE t.`editionId` = e.`id` AND t.`key` = 'session_updated_speaker' AND t.`channel` = 'EMAIL'
);

INSERT INTO `NotificationTemplate` (`id`, `editionId`, `key`, `channel`, `subjectFr`, `subjectEn`, `subjectPt`, `bodyFr`, `bodyEn`, `bodyPt`, `variables`, `createdAt`, `updatedAt`)
SELECT CONCAT('tpl', REPLACE(UUID(), '-', '')), e.`id`, 'session_cancelled', 'EMAIL',
       'Session retirée du programme : {{session}}',
       'Session removed from the programme: {{session}}',
       'Sessão retirada do programa: {{session}}',
       'Bonjour {{prenom}},\n\nLa session « {{session}} », à laquelle vous étiez inscrit(e), a été retirée du programme.\n\nVotre réservation est donc sans objet ; vous n''avez aucune démarche à faire.\n\nLe programme à jour : {{lien_programme}}\nVos réservations : {{lien_espace}}\n\nAvec nos excuses pour ce changement,\nLe comité d''organisation',
       'Hello {{prenom}},\n\nThe session "{{session}}", for which you were registered, has been removed from the programme.\n\nYour booking no longer applies; there is nothing for you to do.\n\nThe up-to-date programme: {{lien_programme}}\nYour bookings: {{lien_espace}}\n\nWith our apologies for this change,\nThe organising committee',
       'Olá {{prenom}},\n\nA sessão «{{session}}», na qual estava inscrito(a), foi retirada do programa.\n\nA sua reserva deixa de ter efeito; não tem nada a fazer.\n\nO programa atualizado: {{lien_programme}}\nAs suas reservas: {{lien_espace}}\n\nCom os nossos pedidos de desculpa por esta alteração,\nO comité organizador',
       JSON_ARRAY('prenom', 'session', 'lien_programme', 'lien_espace'), NOW(3), NOW(3)
FROM `Edition` e
WHERE NOT EXISTS (
  SELECT 1 FROM `NotificationTemplate` t
  WHERE t.`editionId` = e.`id` AND t.`key` = 'session_cancelled' AND t.`channel` = 'EMAIL'
);

INSERT INTO `NotificationTemplate` (`id`, `editionId`, `key`, `channel`, `subjectFr`, `subjectEn`, `subjectPt`, `bodyFr`, `bodyEn`, `bodyPt`, `variables`, `createdAt`, `updatedAt`)
SELECT CONCAT('tpl', REPLACE(UUID(), '-', '')), e.`id`, 'session_cancelled_speaker', 'EMAIL',
       'Session retirée du programme : {{session}}',
       'Session removed from the programme: {{session}}',
       'Sessão retirada do programa: {{session}}',
       'Bonjour {{prenom}},\n\nLa session « {{session}} », à laquelle vous deviez participer comme intervenant(e), a été retirée du programme.\n\nLe comité reprendra contact avec vous si une autre intervention vous est proposée.\n\nLe programme à jour : {{lien_programme}}\n\nAvec nos excuses pour ce changement,\nLe comité d''organisation',
       'Hello {{prenom}},\n\nThe session "{{session}}", in which you were to take part as a speaker, has been removed from the programme.\n\nThe committee will get back to you should another slot be offered.\n\nThe up-to-date programme: {{lien_programme}}\n\nWith our apologies for this change,\nThe organising committee',
       'Olá {{prenom}},\n\nA sessão «{{session}}», na qual iria participar como orador(a), foi retirada do programa.\n\nO comité entrará em contacto consigo caso lhe seja proposta outra intervenção.\n\nO programa atualizado: {{lien_programme}}\n\nCom os nossos pedidos de desculpa por esta alteração,\nO comité organizador',
       JSON_ARRAY('prenom', 'session', 'lien_programme'), NOW(3), NOW(3)
FROM `Edition` e
WHERE NOT EXISTS (
  SELECT 1 FROM `NotificationTemplate` t
  WHERE t.`editionId` = e.`id` AND t.`key` = 'session_cancelled_speaker' AND t.`channel` = 'EMAIL'
);
