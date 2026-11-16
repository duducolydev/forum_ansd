/**
 * Repères du portail : à quoi sert chaque page, dans les trois langues.
 *
 * ## Pourquoi cette table existe
 *
 * Le reste du corpus est extrait de la base : il dit *ce qui est écrit*. Il ne
 * dit pas *où l'on va* pour s'inscrire, vérifier un badge ou retrouver son
 * attestation — ces pages-là portent un formulaire, pas un texte, et un
 * indexeur qui ne lit que du contenu ne les trouve jamais. Elles sont donc
 * déclarées ici, à la main, parce qu'elles changent une fois par édition et que
 * la liste se relit en une minute.
 *
 * ## Les pages qui demandent une connexion
 *
 * « Où est mon badge », « suis-je inscrit à la session 4 », « mon attestation » :
 * la réponse est propre à une personne, elle vit derrière une authentification,
 * et elle n'a rien à faire dans un index. Ces repères portent
 * `connexionRequise`. L'assistant ne cherche pas à y répondre — il renvoie vers
 * `/connexion`. C'est la seule conduite correcte : un assistant qui tenterait
 * une réponse « générale » sur un badge nominatif en inventerait une.
 *
 * Ajouter une page publique au portail suppose de l'ajouter ici **et** dans
 * `app/sitemap.ts` : les deux listes répondent à la même question, et celle-ci
 * est vérifiée par `construire.test.ts`.
 */

export interface TroisLangues {
  fr: string;
  en: string;
  pt: string;
}

export interface Repere {
  /** Suffixe de l'identifiant du document : `repere:<cle>:<langue>`. */
  cle: string;
  /** Chemin, ancre comprise. */
  url: string;
  titre: TroisLangues;
  /** Ce qu'on y trouve, et les questions auxquelles la page répond. */
  texte: TroisLangues;
  /** La page exige une connexion : renvoyer vers `/connexion`, ne pas répondre. */
  connexionRequise?: boolean;
}

export const REPERES: Repere[] = [
  {
    cle: "accueil",
    url: "/",
    titre: { fr: "Accueil", en: "Home", pt: "Início" },
    texte: {
      fr: "Page d'accueil du portail du Forum : présentation, dates, compte à rebours, intervenants mis en avant, dernières actualités et partenaires.",
      en: "Home page of the Forum portal: overview, dates, countdown, featured speakers, latest news and partners.",
      pt: "Página inicial do portal do Fórum: apresentação, datas, contagem decrescente, oradores destacados, últimas notícias e parceiros.",
    },
  },
  {
    cle: "a-propos",
    url: "/#a-propos",
    titre: { fr: "À propos du Forum", en: "About the Forum", pt: "Sobre o Fórum" },
    texte: {
      fr: "Objectifs du Forum, thème de l'édition, public visé et organisateurs. Section de la page d'accueil ; l'ancienne adresse /a-propos y redirige.",
      en: "Aims of the Forum, theme of the edition, intended audience and organisers. A section of the home page; the former /a-propos address redirects here.",
      pt: "Objetivos do Fórum, tema da edição, público-alvo e organizadores. Secção da página inicial; o antigo endereço /a-propos redireciona para aqui.",
    },
  },
  {
    cle: "programme",
    url: "/programme",
    titre: { fr: "Programme", en: "Programme", pt: "Programa" },
    texte: {
      fr: "Programme complet, jour par jour : séances plénières, panels, conférences, pauses et événements parallèles, avec horaires, salles et intervenants. Chaque séance a sa page de détail.",
      en: "Full programme, day by day: plenaries, panels, lectures, breaks and side events, with times, rooms and speakers. Each session has its own detail page.",
      pt: "Programa completo, dia a dia: plenárias, painéis, conferências, pausas e eventos paralelos, com horários, salas e oradores. Cada sessão tem a sua própria página.",
    },
  },
  {
    cle: "intervenants",
    url: "/intervenants",
    titre: { fr: "Intervenants", en: "Speakers", pt: "Oradores" },
    texte: {
      fr: "Annuaire des intervenants publiés : fonction, institution, pays, biographie et séances où ils interviennent. Filtrable par thème et par rôle.",
      en: "Directory of published speakers: role, institution, country, biography and the sessions they take part in. Filterable by theme and by role.",
      pt: "Diretório dos oradores publicados: função, instituição, país, biografia e sessões em que participam. Filtrável por tema e por função.",
    },
  },
  {
    cle: "sponsors",
    url: "/sponsors",
    titre: { fr: "Partenaires", en: "Partners", pt: "Parceiros" },
    texte: {
      fr: "Partenaires et sponsors de l'édition, avec leur niveau de partenariat, leur présentation et, le cas échéant, leur numéro de stand.",
      en: "Partners and sponsors of the edition, with their partnership level, their profile and, where applicable, their stand number.",
      pt: "Parceiros e patrocinadores da edição, com o nível de parceria, a apresentação e, quando aplicável, o número do stand.",
    },
  },
  {
    cle: "contributions",
    url: "/contributions",
    titre: {
      fr: "Contributions & Actes",
      en: "Contributions & Proceedings",
      pt: "Contribuições e Atas",
    },
    texte: {
      fr: "Capitalisation du Forum, séance par séance : communications, présentations, rapports et synthèses publiés par le comité.",
      en: "Outputs of the Forum, session by session: papers, presentations, reports and summaries published by the committee.",
      pt: "Capitalização do Fórum, sessão a sessão: comunicações, apresentações, relatórios e sínteses publicados pelo comité.",
    },
  },
  {
    cle: "infos-pratiques",
    url: "/infos-pratiques",
    titre: { fr: "Infos pratiques", en: "Practical information", pt: "Informações práticas" },
    texte: {
      fr: "Tout ce qui concerne la venue : lieu du Forum, arrivée à Dakar, hébergement et tarifs négociés, visas, transports sur place, et contacts du comité d'organisation.",
      en: "Everything about attending: Forum venue, arriving in Dakar, accommodation and negotiated rates, visas, local transport, and organising committee contacts.",
      pt: "Tudo sobre a vinda: local do Fórum, chegada a Dacar, alojamento e tarifas negociadas, vistos, transportes locais e contactos do comité organizador.",
    },
  },
  {
    cle: "actualites",
    url: "/actualites",
    titre: { fr: "Actualités", en: "News", pt: "Notícias" },
    texte: {
      fr: "Articles publiés par le comité d'organisation avant, pendant et après le Forum.",
      en: "Articles published by the organising committee before, during and after the Forum.",
      pt: "Artigos publicados pelo comité organizador antes, durante e depois do Fórum.",
    },
  },
  {
    cle: "newsletters",
    url: "/newsletters",
    titre: { fr: "Newsletters", en: "Newsletters", pt: "Newsletters" },
    texte: {
      fr: "Lettres d'information du Forum, telles qu'envoyées aux participants et archivées sur le site.",
      en: "Forum newsletters, as sent to participants and archived on the site.",
      pt: "Boletins informativos do Fórum, tal como enviados aos participantes e arquivados no site.",
    },
  },
  {
    cle: "mediatheque",
    url: "/mediatheque",
    titre: { fr: "Médiathèque", en: "Media library", pt: "Mediateca" },
    texte: {
      fr: "Photos et vidéos du Forum, regroupées par album : cérémonies, séances, visites et moments forts.",
      en: "Photos and videos of the Forum, grouped into albums: ceremonies, sessions, visits and highlights.",
      pt: "Fotografias e vídeos do Fórum, agrupados por álbum: cerimónias, sessões, visitas e momentos marcantes.",
    },
  },
  {
    cle: "inscription",
    url: "/inscription",
    titre: { fr: "S'inscrire au Forum", en: "Register for the Forum", pt: "Inscrever-se no Fórum" },
    texte: {
      fr: "Formulaire d'inscription en ligne. À utiliser pour toute question du type « comment je m'inscris », « où je m'enregistre », « comment participer ». L'inscription est ensuite validée par le comité, qui répond par courriel.",
      en: "Online registration form. Use for any question such as « how do I register », « where do I sign up », « how can I attend ». Registration is then validated by the committee, which replies by email.",
      pt: "Formulário de inscrição em linha. A usar para qualquer pergunta do tipo « como me inscrevo », « onde me registo », « como participar ». A inscrição é depois validada pelo comité, que responde por correio eletrónico.",
    },
  },
  {
    cle: "verifier",
    url: "/verifier",
    titre: { fr: "Vérifier un badge", en: "Verify a badge", pt: "Verificar um crachá" },
    texte: {
      fr: "Contrôle de l'authenticité d'un badge du Forum à partir de son code. Page publique, destinée aux agents d'accueil et de sécurité.",
      en: "Checks whether a Forum badge is genuine, from its code. Public page, intended for reception and security staff.",
      pt: "Verifica a autenticidade de um crachá do Fórum a partir do seu código. Página pública, destinada ao pessoal de receção e segurança.",
    },
  },
  {
    cle: "connexion",
    url: "/connexion",
    titre: { fr: "Se connecter", en: "Sign in", pt: "Entrar" },
    texte: {
      fr: "Connexion des participants et des intervenants, par lien reçu par courriel. C'est le point d'entrée de tout ce qui est personnel : badge, inscriptions aux séances, attestation, dépôt de présentation.",
      en: "Sign-in for participants and speakers, via a link received by email. It is the entry point for everything personal: badge, session registrations, certificate, uploading a presentation.",
      pt: "Acesso de participantes e oradores, através de um link recebido por correio eletrónico. É o ponto de entrada para tudo o que é pessoal: crachá, inscrições nas sessões, certificado, envio de apresentação.",
    },
  },
  {
    cle: "mon-espace",
    url: "/mon-espace",
    titre: {
      fr: "Mon espace participant",
      en: "My participant area",
      pt: "A minha área de participante",
    },
    connexionRequise: true,
    texte: {
      fr: "Espace personnel du participant, après connexion : son badge, ses inscriptions aux séances, ses documents. Les réponses y sont propres à chaque personne : pour toute question de ce type — « où est mon badge », « suis-je inscrit à telle séance », « mon inscription est-elle validée » — il faut renvoyer vers la connexion, et ne jamais tenter de répondre.",
      en: "The participant's personal area, once signed in: their badge, their session registrations, their documents. Answers here are specific to each person: for any such question — « where is my badge », « am I registered for that session », « has my registration been approved » — point to the sign-in page and never attempt an answer.",
      pt: "Área pessoal do participante, após autenticação: o seu crachá, as suas inscrições nas sessões, os seus documentos. As respostas são próprias de cada pessoa: para qualquer pergunta deste tipo — « onde está o meu crachá », « estou inscrito nesta sessão », « a minha inscrição foi validada » — deve remeter para a página de acesso e nunca tentar responder.",
    },
  },
  {
    cle: "espace-intervenant",
    url: "/espace-intervenant",
    titre: { fr: "Espace intervenant", en: "Speaker area", pt: "Área do orador" },
    connexionRequise: true,
    texte: {
      fr: "Espace réservé aux intervenants, après connexion : fiche à relire, biographie, photo et dépôt de la présentation. Questions personnelles : renvoyer vers la connexion.",
      en: "Area reserved for speakers, once signed in: profile to review, biography, photo and presentation upload. Personal questions: point to the sign-in page.",
      pt: "Área reservada aos oradores, após autenticação: ficha a revisar, biografia, fotografia e envio da apresentação. Perguntas pessoais: remeter para a página de acesso.",
    },
  },
  {
    cle: "mentions-legales",
    url: "/mentions-legales",
    titre: { fr: "Mentions légales", en: "Legal notice", pt: "Avisos legais" },
    texte: {
      fr: "Éditeur du site, hébergement, propriété intellectuelle et conditions d'utilisation du portail.",
      en: "Site publisher, hosting, intellectual property and terms of use of the portal.",
      pt: "Editor do site, alojamento, propriedade intelectual e condições de utilização do portal.",
    },
  },
  {
    cle: "confidentialite",
    url: "/confidentialite",
    titre: { fr: "Confidentialité", en: "Privacy", pt: "Privacidade" },
    texte: {
      fr: "Traitement des données personnelles des participants : ce qui est collecté, pourquoi, pendant combien de temps, et comment exercer ses droits.",
      en: "How participants' personal data is handled: what is collected, why, for how long, and how to exercise your rights.",
      pt: "Tratamento dos dados pessoais dos participantes: o que é recolhido, por que razão, durante quanto tempo e como exercer os seus direitos.",
    },
  },
];
