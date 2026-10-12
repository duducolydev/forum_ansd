-- 12 octobre 2026 : propositions de la cellule communication (document
-- « Modèles courriels_Forum 2026 », relu par Awa DIOP).
--
-- Chaque langue n'est remplacée que si son texte est encore celui d'origine :
-- un modèle retouché dans le BackOffice n'est jamais écrasé.

-- 01 Invitation : le lien sert à confirmer l'inscription, et c'est obligatoire.
UPDATE `NotificationTemplate`
SET `bodyFr` = 'Bonjour {{prenom}},\n\nVous êtes invité(e) à participer au Forum international sur les données de l''ANSD, du 23 au 25 novembre 2026 à Dakar.\n\nConfirmez votre inscription via votre lien personnalisé (confirmation obligatoire !) : {{lien_inscription}}\n\nCordialement,\nLe comité d''organisation'
WHERE `key` = 'invitation' AND `channel` = 'EMAIL'
  AND `bodyFr` = 'Bonjour {{prenom}},\n\nVous êtes invité(e) à participer au Forum international sur les données de l''ANSD, du 23 au 25 novembre 2026 à Dakar.\n\nInscrivez-vous via votre lien personnalisé : {{lien_inscription}}\n\nCordialement,\nLe comité d''organisation';

UPDATE `NotificationTemplate`
SET `bodyEn` = 'Hello {{prenom}},\n\nYou are invited to the ANSD International Data Forum, 23–25 November 2026 in Dakar.\n\nPlease confirm your registration using your personal link (confirmation required!): {{lien_inscription}}\n\nBest regards,\nThe organising committee'
WHERE `key` = 'invitation' AND `channel` = 'EMAIL'
  AND `bodyEn` = 'Hello {{prenom}},\n\nYou are invited to the ANSD International Data Forum, 23–25 November 2026 in Dakar.\n\nPlease register using your personal link: {{lien_inscription}}\n\nBest regards,\nThe organising committee';

UPDATE `NotificationTemplate`
SET `bodyPt` = 'Olá {{prenom}},\n\nEstá convidado(a) para o Fórum Internacional sobre Dados da ANSD, de 23 a 25 de novembro de 2026, em Dacar.\n\nConfirme a sua inscrição através da sua ligação pessoal (confirmação obrigatória!): {{lien_inscription}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'invitation' AND `channel` = 'EMAIL'
  AND `bodyPt` = 'Olá {{prenom}},\n\nEstá convidado(a) para o Fórum Internacional sobre Dados da ANSD, de 23 a 25 de novembro de 2026, em Dacar.\n\nInscreva-se através da sua ligação pessoal: {{lien_inscription}}\n\nCom os melhores cumprimentos,\nO comité organizador';

-- 02 Relance : il ne reste que quelques places.
UPDATE `NotificationTemplate`
SET `bodyFr` = 'Bonjour {{prenom}},\n\nNous n''avons pas encore reçu votre inscription au Forum. Il ne reste que quelques places : {{lien_inscription}}\n\nCordialement,\nLe comité d''organisation'
WHERE `key` = 'invitation_reminder' AND `channel` = 'EMAIL'
  AND `bodyFr` = 'Bonjour {{prenom}},\n\nNous n''avons pas encore reçu votre inscription au Forum. Il reste des places : {{lien_inscription}}\n\nCordialement,\nLe comité d''organisation';

UPDATE `NotificationTemplate`
SET `bodyEn` = 'Hello {{prenom}},\n\nWe have not yet received your registration for the Forum. Only a few places remain: {{lien_inscription}}\n\nBest regards,\nThe organising committee'
WHERE `key` = 'invitation_reminder' AND `channel` = 'EMAIL'
  AND `bodyEn` = 'Hello {{prenom}},\n\nWe have not yet received your registration for the Forum. Places remain available: {{lien_inscription}}\n\nBest regards,\nThe organising committee';

UPDATE `NotificationTemplate`
SET `bodyPt` = 'Olá {{prenom}},\n\nAinda não recebemos a sua inscrição no Fórum. Restam apenas alguns lugares: {{lien_inscription}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'invitation_reminder' AND `channel` = 'EMAIL'
  AND `bodyPt` = 'Olá {{prenom}},\n\nAinda não recebemos a sua inscrição no Fórum. Ainda há lugares disponíveis: {{lien_inscription}}\n\nCom os melhores cumprimentos,\nO comité organizador';

-- 04 Participation confirmée : ce que l'espace apporte.
UPDATE `NotificationTemplate`
SET `bodyFr` = 'Bonjour {{prenom}},\n\nVotre participation au Forum international sur les données est confirmée.\n\nAfin d''avoir accès au programme mis à jour, à la liste des panélistes et à toutes les informations utiles sur le Forum, accédez directement à votre espace, sans autre démarche : {{lien_espace}}\nCe lien vous est personnel ; il reste valable 14 jours.\n\nCode d''accès de secours, à saisir avec votre adresse e-mail sur la page « Mon espace » : {{code6}}\n{{referent_bloc}}\n\nCordialement,\nLe comité d''organisation'
WHERE `key` = 'registration_confirmed' AND `channel` = 'EMAIL'
  AND `bodyFr` = 'Bonjour {{prenom}},\n\nVotre participation au Forum international sur les données est confirmée.\n\nAccédez directement à votre espace, sans autre démarche : {{lien_espace}}\nCe lien vous est personnel ; il reste valable 14 jours.\n\nCode d''accès de secours, à saisir avec votre adresse e-mail sur la page « Mon espace » : {{code6}}\n{{referent_bloc}}\n\nCordialement,\nLe comité d''organisation';

UPDATE `NotificationTemplate`
SET `bodyEn` = 'Hello {{prenom}},\n\nYour participation in the International Data Forum is confirmed.\n\nTo access the updated programme, the list of panellists and all useful information about the Forum, go straight to your personal space, with no further step: {{lien_espace}}\nThis link is personal and remains valid for 14 days.\n\nBackup access code, to enter with your e-mail address on the "My space" page: {{code6}}\n{{referent_bloc}}\n\nBest regards,\nThe organising committee'
WHERE `key` = 'registration_confirmed' AND `channel` = 'EMAIL'
  AND `bodyEn` = 'Hello {{prenom}},\n\nYour participation in the International Data Forum is confirmed.\n\nGo straight to your personal space, with no further step: {{lien_espace}}\nThis link is personal and remains valid for 14 days.\n\nBackup access code, to enter with your e-mail address on the "My space" page: {{code6}}\n{{referent_bloc}}\n\nBest regards,\nThe organising committee';

UPDATE `NotificationTemplate`
SET `bodyPt` = 'Olá {{prenom}},\n\nA sua participação no Fórum Internacional sobre Dados está confirmada.\n\nPara ter acesso ao programa atualizado, à lista de painelistas e a todas as informações úteis sobre o Fórum, aceda diretamente ao seu espaço, sem mais nenhum passo: {{lien_espace}}\nEsta ligação é pessoal e é válida durante 14 dias.\n\nCódigo de acesso de reserva, a introduzir com o seu endereço de e-mail na página «O meu espaço»: {{code6}}\n{{referent_bloc}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'registration_confirmed' AND `channel` = 'EMAIL'
  AND `bodyPt` = 'Olá {{prenom}},\n\nA sua participação no Fórum Internacional sobre Dados está confirmada.\n\nAceda diretamente ao seu espaço, sem mais nenhum passo: {{lien_espace}}\nEsta ligação é pessoal e é válida durante 14 dias.\n\nCódigo de acesso de reserva, a introduzir com o seu endereço de e-mail na página «O meu espaço»: {{code6}}\n{{referent_bloc}}\n\nCom os melhores cumprimentos,\nO comité organizador';

-- 05 Inscription par le comité : idem.
UPDATE `NotificationTemplate`
SET `bodyFr` = 'Bonjour {{prenom}},\n\nSuite à la confirmation de votre participation, le comité d''organisation vous a inscrit(e) au Forum international sur les données. Vous n''avez aucune démarche d''inscription à faire.\n\nAfin d''avoir accès au programme mis à jour, à la liste des panélistes et à toutes les informations utiles sur le Forum, accédez directement à votre espace : {{lien_espace}}\nCe lien vous est personnel ; il reste valable 14 jours.\n\nCode d''accès de secours, à saisir avec votre adresse e-mail sur la page « Mon espace » : {{code6}}\n\nDans votre espace, vous pourrez vérifier et compléter vos informations, ajouter votre photo et télécharger votre badge. Un e-mail vous préviendra dès que le badge sera prêt.\n{{referent_bloc}}\n\nCordialement,\nLe comité d''organisation'
WHERE `key` = 'registration_imported' AND `channel` = 'EMAIL'
  AND `bodyFr` = 'Bonjour {{prenom}},\n\nSuite à la confirmation de votre participation, le comité d''organisation vous a inscrit(e) au Forum international sur les données. Vous n''avez aucune démarche d''inscription à faire.\n\nAccédez directement à votre espace : {{lien_espace}}\nCe lien vous est personnel ; il reste valable 14 jours.\n\nCode d''accès de secours, à saisir avec votre adresse e-mail sur la page « Mon espace » : {{code6}}\n\nDans votre espace, vous pourrez vérifier et compléter vos informations, ajouter votre photo et télécharger votre badge. Un e-mail vous préviendra dès que le badge sera prêt.\n{{referent_bloc}}\n\nCordialement,\nLe comité d''organisation';

UPDATE `NotificationTemplate`
SET `bodyEn` = 'Hello {{prenom}},\n\nFollowing the confirmation of your participation, the organising committee has registered you for the International Data Forum. There is no registration step left for you to complete.\n\nTo access the updated programme, the list of panellists and all useful information about the Forum, go straight to your personal space: {{lien_espace}}\nThis link is personal and remains valid for 14 days.\n\nBackup access code, to enter with your e-mail address on the "My space" page: {{code6}}\n\nIn your space, you can check and complete your details, add your photo and download your badge. An e-mail will let you know as soon as the badge is ready.\n{{referent_bloc}}\n\nBest regards,\nThe organising committee'
WHERE `key` = 'registration_imported' AND `channel` = 'EMAIL'
  AND `bodyEn` = 'Hello {{prenom}},\n\nFollowing the confirmation of your participation, the organising committee has registered you for the International Data Forum. There is no registration step left for you to complete.\n\nGo straight to your personal space: {{lien_espace}}\nThis link is personal and remains valid for 14 days.\n\nBackup access code, to enter with your e-mail address on the "My space" page: {{code6}}\n\nIn your space, you can check and complete your details, add your photo and download your badge. An e-mail will let you know as soon as the badge is ready.\n{{referent_bloc}}\n\nBest regards,\nThe organising committee';

UPDATE `NotificationTemplate`
SET `bodyPt` = 'Olá {{prenom}},\n\nNa sequência da confirmação da sua participação, o comité organizador inscreveu-o(a) no Fórum Internacional sobre Dados. Não tem nenhum passo de inscrição a realizar.\n\nPara ter acesso ao programa atualizado, à lista de painelistas e a todas as informações úteis sobre o Fórum, aceda diretamente ao seu espaço: {{lien_espace}}\nEsta ligação é pessoal e é válida durante 14 dias.\n\nCódigo de acesso de reserva, a introduzir com o seu endereço de e-mail na página «O meu espaço»: {{code6}}\n\nNo seu espaço, pode verificar e completar os seus dados, acrescentar a sua fotografia e descarregar o seu crachá. Um e-mail avisá-lo(a)-á assim que o crachá estiver pronto.\n{{referent_bloc}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'registration_imported' AND `channel` = 'EMAIL'
  AND `bodyPt` = 'Olá {{prenom}},\n\nNa sequência da confirmação da sua participação, o comité organizador inscreveu-o(a) no Fórum Internacional sobre Dados. Não tem nenhum passo de inscrição a realizar.\n\nAceda diretamente ao seu espaço: {{lien_espace}}\nEsta ligação é pessoal e é válida durante 14 dias.\n\nCódigo de acesso de reserva, a introduzir com o seu endereço de e-mail na página «O meu espaço»: {{code6}}\n\nNo seu espaço, pode verificar e completar os seus dados, acrescentar a sua fotografia e descarregar o seu crachá. Um e-mail avisá-lo(a)-á assim que o crachá estiver pronto.\n{{referent_bloc}}\n\nCom os melhores cumprimentos,\nO comité organizador';

-- 11 Rappel à une semaine : le badge est obligatoire.
UPDATE `NotificationTemplate`
SET `bodyFr` = 'Bonjour {{prenom}},\n\nLe Forum international sur les données ouvre dans une semaine, du 23 au 25 novembre 2026 à l''Hôtel King Fahd Palace, à Dakar.\n\nPensez à télécharger votre badge avant de venir : le badge est obligatoire et vous sera demandé à l''entrée. Téléchargez-le dans votre espace : {{lien_espace}}\n\nÀ très bientôt,\nLe comité d''organisation'
WHERE `key` = 'reminder_j7' AND `channel` = 'EMAIL'
  AND `bodyFr` = 'Bonjour {{prenom}},\n\nLe Forum international sur les données ouvre dans une semaine, du 23 au 25 novembre 2026 à l''Hôtel King Fahd Palace, à Dakar.\n\nPensez à télécharger votre badge avant de venir : il vous sera demandé à l''entrée. Retrouvez-le dans votre espace : {{lien_espace}}\n\nÀ très bientôt,\nLe comité d''organisation';

UPDATE `NotificationTemplate`
SET `bodyEn` = 'Hello {{prenom}},\n\nThe International Data Forum opens in one week, from 23 to 25 November 2026 at the King Fahd Palace Hotel in Dakar.\n\nPlease download your badge before you come: the badge is mandatory and will be checked at the entrance. Download it from your personal space: {{lien_espace}}\n\nSee you soon,\nThe organising committee'
WHERE `key` = 'reminder_j7' AND `channel` = 'EMAIL'
  AND `bodyEn` = 'Hello {{prenom}},\n\nThe International Data Forum opens in one week, from 23 to 25 November 2026 at the King Fahd Palace Hotel in Dakar.\n\nPlease download your badge before you come: it will be checked at the entrance. Find it in your personal space: {{lien_espace}}\n\nSee you soon,\nThe organising committee';

UPDATE `NotificationTemplate`
SET `bodyPt` = 'Olá {{prenom}},\n\nO Fórum Internacional sobre Dados abre dentro de uma semana, de 23 a 25 de novembro de 2026, no Hotel King Fahd Palace, em Dacar.\n\nDescarregue o seu crachá antes de vir: o crachá é obrigatório e será verificado à entrada. Descarregue-o no seu espaço pessoal: {{lien_espace}}\n\nAté breve,\nO comité organizador'
WHERE `key` = 'reminder_j7' AND `channel` = 'EMAIL'
  AND `bodyPt` = 'Olá {{prenom}},\n\nO Fórum Internacional sobre Dados abre dentro de uma semana, de 23 a 25 de novembro de 2026, no Hotel King Fahd Palace, em Dacar.\n\nDescarregue o seu crachá antes de vir: será verificado à entrada. Encontra-o no seu espaço pessoal: {{lien_espace}}\n\nAté breve,\nO comité organizador';

-- 07 bis : refus de l'accréditation presse, jusqu'ici sans e-mail.
INSERT INTO `NotificationTemplate` (`id`, `editionId`, `key`, `channel`, `subjectFr`, `subjectEn`, `subjectPt`, `bodyFr`, `bodyEn`, `bodyPt`, `variables`, `createdAt`, `updatedAt`)
SELECT CONCAT('tpl', REPLACE(UUID(), '-', '')), e.`id`, 'accreditation_declined', 'EMAIL',
       'Votre demande d''accréditation presse',
       'Your press accreditation request',
       'O seu pedido de acreditação de imprensa',
       'Bonjour {{prenom}},\n\nNous vous remercions de votre intérêt pour le Forum international sur les données.\n\nAprès examen, nous ne sommes malheureusement pas en mesure de donner une suite favorable à votre demande d''accréditation presse.\n\nPour toute question, vous pouvez écrire au comité d''organisation depuis la rubrique « Nous écrire » du portail.\n\nCordialement,\nLe comité d''organisation',
       'Hello {{prenom}},\n\nThank you for your interest in the International Data Forum.\n\nAfter review, we regret that we are unable to grant your press accreditation request.\n\nIf you have any questions, you can write to the organising committee through the "Write to us" section of the portal.\n\nBest regards,\nThe organising committee',
       'Olá {{prenom}},\n\nAgradecemos o seu interesse pelo Fórum Internacional sobre Dados.\n\nApós análise, lamentamos não poder dar seguimento favorável ao seu pedido de acreditação de imprensa.\n\nPara qualquer questão, pode escrever ao comité organizador através da secção «Escreva-nos» do portal.\n\nCom os melhores cumprimentos,\nO comité organizador',
       JSON_ARRAY('prenom'), NOW(3), NOW(3)
FROM `Edition` e
WHERE NOT EXISTS (
  SELECT 1 FROM `NotificationTemplate` t
  WHERE t.`editionId` = e.`id` AND t.`key` = 'accreditation_declined' AND t.`channel` = 'EMAIL'
);
