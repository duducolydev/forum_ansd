-- Portugais (30 septembre 2026) : traductions de départ, depuis
-- prisma/modeles-pt.json. Seuls les champs portugais encore vides sont
-- remplis : un texte déjà saisi en BackOffice n'est jamais écrasé.

-- Modèles d'e-mails destinés aux participants.
UPDATE `NotificationTemplate`
SET `subjectPt` = 'A sua acreditação de imprensa foi concedida',
    `bodyPt` = 'Olá {{prenom}},\n\nA sua acreditação de imprensa para o Fórum Internacional sobre Dados foi concedida: a sua conta está ativa.\n\nAceda diretamente ao seu espaço: {{lien_espace}}\nEsta ligação é pessoal e é válida durante 14 dias.\n\nCódigo de acesso de reserva, a introduzir com o seu endereço de e-mail na página «O meu espaço»: {{code6}}\n\nO seu crachá de imprensa, com a menção «Acreditação de imprensa», estará aí disponível assim que for gerado.\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'accreditation_granted' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'O seu pedido de acreditação de imprensa foi recebido',
    `bodyPt` = 'Olá {{prenom}},\n\nRecebemos o seu pedido de acreditação de imprensa para o Fórum Internacional sobre Dados.\n\nA sua conta será ativada assim que a administração do Fórum conceder a sua acreditação. Receberá então um e-mail com acesso direto ao seu espaço, onde estará disponível o seu crachá de imprensa.\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'accreditation_pending' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'O seu crachá está disponível',
    `bodyPt` = 'Olá {{prenom}},\n\nO seu crachá para o Fórum Internacional sobre Dados está pronto. Descarregue-o aqui: {{lien_badge}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'badge_ready' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'Está convidado(a) para o Fórum Internacional sobre Dados',
    `bodyPt` = 'Olá {{prenom}},\n\nEstá convidado(a) para o Fórum Internacional sobre Dados da ANSD, de 23 a 25 de novembro de 2026, em Dacar.\n\nInscreva-se através da sua ligação pessoal: {{lien_inscription}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'invitation' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'Lembrete — Inscrição no Fórum Internacional sobre Dados',
    `bodyPt` = 'Olá {{prenom}},\n\nAinda não recebemos a sua inscrição no Fórum. Ainda há lugares disponíveis: {{lien_inscription}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'invitation_reminder' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'A sua ligação de acesso a «O meu espaço»',
    `bodyPt` = 'Olá,\n\nEis a sua ligação de acesso ao seu espaço de participante, válida durante 30 minutos: {{lien_connexion}}\n\nCódigo de reserva: {{code6}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'magic_link' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = '{{titre}}',
    `bodyPt` = 'Olá {{prenom}},\n\n{{titre}}\n\n{{chapo}}\n\nLeia o texto completo com ilustrações e descarregue-o em PDF:\n{{lien_newsletter}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'newsletter_published' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'A sua participação no Fórum está confirmada',
    `bodyPt` = 'Olá {{prenom}},\n\nA sua participação no Fórum Internacional sobre Dados está confirmada.\n\nAceda diretamente ao seu espaço, sem mais nenhum passo: {{lien_espace}}\nEsta ligação é pessoal e é válida durante 14 dias.\n\nCódigo de acesso de reserva, a introduzir com o seu endereço de e-mail na página «O meu espaço»: {{code6}}\n{{referent_bloc}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'registration_confirmed' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'A sua inscrição no Fórum Internacional sobre Dados',
    `bodyPt` = 'Olá {{prenom}},\n\nNa sequência da confirmação da sua participação, o comité organizador inscreveu-o(a) no Fórum Internacional sobre Dados. Não tem nenhum passo de inscrição a realizar.\n\nAceda diretamente ao seu espaço: {{lien_espace}}\nEsta ligação é pessoal e é válida durante 14 dias.\n\nCódigo de acesso de reserva, a introduzir com o seu endereço de e-mail na página «O meu espaço»: {{code6}}\n\nNo seu espaço, pode verificar e completar os seus dados, acrescentar a sua fotografia e descarregar o seu crachá. Um e-mail avisá-lo(a)-á assim que o crachá estiver pronto.\n{{referent_bloc}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'registration_imported' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'A sua inscrição foi recebida',
    `bodyPt` = 'Olá {{prenom}},\n\nA sua inscrição no Fórum foi recebida e aguarda validação pelo comité organizador.\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'registration_received' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'O Fórum começa amanhã',
    `bodyPt` = 'Olá {{prenom}},\n\nO Fórum Internacional sobre Dados abre amanhã de manhã no Hotel King Fahd Palace, em Dacar. O balcão de acolhimento abre às 8h00.\n\nApresente o código QR do seu crachá à entrada, no telemóvel ou impresso: {{lien_espace}}\n\nTenha um bom dia,\nO comité organizador'
WHERE `key` = 'reminder_j1' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'O Fórum abre dentro de uma semana',
    `bodyPt` = 'Olá {{prenom}},\n\nO Fórum Internacional sobre Dados abre dentro de uma semana, de 23 a 25 de novembro de 2026, no Hotel King Fahd Palace, em Dacar.\n\nDescarregue o seu crachá antes de vir: será verificado à entrada. Encontra-o no seu espaço pessoal: {{lien_espace}}\n\nAté breve,\nO comité organizador'
WHERE `key` = 'reminder_j7' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'Vagou um lugar: {{session}}',
    `bodyPt` = 'Olá {{prenom}},\n\nVagou um lugar na sessão «{{session}}» e era o(a) primeiro(a) na lista de espera: a sua inscrição está agora confirmada.\n\nConsulte o seu programa no seu espaço pessoal: {{lien_espace}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'session_promoted' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'O seu espaço de orador — Fórum Internacional sobre Dados',
    `bodyPt` = 'Olá {{prenom}},\n\nEis a sua ligação de acesso ao espaço de orador, válida durante 30 minutos: {{lien_connexion}}\n\nPode aí carregar a sua fotografia, a sua biografia e a sua apresentação.\n\nCódigo de reserva: {{code6}}\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'speaker_link' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

UPDATE `NotificationTemplate`
SET `subjectPt` = 'Obrigado pela sua participação no Fórum',
    `bodyPt` = 'Olá {{prenom}},\n\nObrigado por ter participado no Fórum Internacional sobre Dados. As atas do Fórum estarão em breve disponíveis no portal.\n\nCom os melhores cumprimentos,\nO comité organizador'
WHERE `key` = 'thank_you' AND `channel` = 'EMAIL' AND `subjectPt` IS NULL AND `bodyPt` IS NULL;

-- Libellés des catégories de participation.
UPDATE `ParticipantCategory` SET `labelPt` = 'Autoridade / VIP' WHERE `code` = 'AUTORITE_VIP' AND `labelPt` IS NULL;
UPDATE `ParticipantCategory` SET `labelPt` = 'Autoridades administrativas' WHERE `code` = 'AUTORITE_ADMIN' AND `labelPt` IS NULL;
UPDATE `ParticipantCategory` SET `labelPt` = 'Participante nacional' WHERE `code` = 'PARTICIPANT_NATIONAL' AND `labelPt` IS NULL;
UPDATE `ParticipantCategory` SET `labelPt` = 'Participante internacional' WHERE `code` = 'PARTICIPANT_INTERNATIONAL' AND `labelPt` IS NULL;
UPDATE `ParticipantCategory` SET `labelPt` = 'Instituto nacional de estatística' WHERE `code` = 'INS' AND `labelPt` IS NULL;
UPDATE `ParticipantCategory` SET `labelPt` = 'Organização internacional' WHERE `code` = 'ORG_INTERNATIONALE' AND `labelPt` IS NULL;
UPDATE `ParticipantCategory` SET `labelPt` = 'Parceiro técnico e financeiro' WHERE `code` = 'PTF' AND `labelPt` IS NULL;
UPDATE `ParticipantCategory` SET `labelPt` = 'Patrocinador' WHERE `code` = 'SPONSOR' AND `labelPt` IS NULL;
UPDATE `ParticipantCategory` SET `labelPt` = 'Comunicação social' WHERE `code` = 'MEDIA' AND `labelPt` IS NULL;
UPDATE `ParticipantCategory` SET `labelPt` = 'Pessoal da ANSD' WHERE `code` = 'PERSONNEL_ANSD' AND `labelPt` IS NULL;
UPDATE `ParticipantCategory` SET `labelPt` = 'Prestador de serviços/Fornecedor' WHERE `code` = 'PRESTATAIRE' AND `labelPt` IS NULL;
UPDATE `ParticipantCategory` SET `labelPt` = 'Convidado especial' WHERE `code` = 'INVITE_SPECIAL' AND `labelPt` IS NULL;

-- Nom du Forum en portugais.
UPDATE `Edition` SET `titlePt` = 'Fórum Internacional sobre Dados' WHERE `titlePt` IS NULL;
