-- 6 octobre 2026 : chaque inscription en ligne attend la validation du comité
-- avant le badge. L'accusé de réception l'annonce désormais.
--
-- Chaque langue n'est remplacée que si son texte est encore celui d'origine :
-- un modèle retouché dans le BackOffice n'est jamais écrasé.

UPDATE `NotificationTemplate`
SET `bodyFr` = 'Bonjour {{prenom}},\n\nVotre inscription au Forum international sur les données a bien été reçue. Elle doit maintenant être validée par le comité d''organisation.\n\nVotre badge sera disponible dans votre espace personnel dès que votre inscription aura été validée. Vous recevrez alors un e-mail de confirmation, puis un second lorsque votre badge sera prêt.\n\nCordialement,\nLe comité d''organisation'
WHERE `key` = 'registration_received' AND `channel` = 'EMAIL'
  AND `bodyFr` = 'Bonjour {{prenom}},\n\nVotre inscription au Forum a bien été reçue et est en attente de validation par le comité d''organisation.\n\nCordialement,\nLe comité d''organisation';

UPDATE `NotificationTemplate`
SET `bodyEn` = 'Hello {{prenom}},\n\nYour registration for the International Data Forum has been received. It must now be validated by the organising committee.\n\nYour badge will be available in your personal space as soon as your registration has been validated. You will then receive a confirmation e-mail, followed by a second one when your badge is ready.\n\nBest regards,\nThe organising committee'
WHERE `key` = 'registration_received' AND `channel` = 'EMAIL'
  AND `bodyEn` = 'Hello {{prenom}},\n\nYour registration for the Forum has been received and is pending validation by the organising committee.\n\nBest regards,\nThe organising committee';

UPDATE `NotificationTemplate`
SET `bodyPt` = 'Olá {{prenom}},\n\nA sua inscrição no Fórum Internacional sobre Dados foi recebida. Deve agora ser validada pelo comité organizador.\n\nO seu crachá estará disponível no seu espaço pessoal assim que a sua inscrição for validada. Receberá então um e-mail de confirmação e, depois, um segundo quando o crachá estiver pronto.\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'registration_received' AND `channel` = 'EMAIL'
  AND `bodyPt` = 'Olá {{prenom}},\n\nA sua inscrição no Fórum foi recebida e aguarda validação pelo comité organizador.\n\nCom os melhores cumprimentos,\nO comité organizador';
