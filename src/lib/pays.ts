/**
 * Pays : liste de référence et reconnaissance des saisies (6 novembre 2026).
 *
 * Le champ « Pays » était un texte libre : on trouvait en base « Sénégal »,
 * « Senegal », « SN », « Sn »… — autant de pays différents pour les filtres,
 * les statistiques et les exports. Les formulaires proposent désormais cette
 * liste (`ChampPays`), et le BackOffice ramène les valeurs existantes à elle
 * (Paramètres › Pays).
 *
 * **Valeur enregistrée : le nom français**, tel qu'il figure ici. C'est la
 * forme déjà la plus répandue en base, celle qu'affichent pages, badges et
 * exports : la garder évite de réécrire chaque affichage. La liste montre le
 * nom dans la langue de la page, mais enregistre toujours le nom français.
 *
 * Données figées dans le code, et non calculées par `Intl.DisplayNames` à
 * l'exécution : Node et les navigateurs n'ont pas les mêmes tables (« Congo-
 * Kinshasa » ou « Congo (RDC) »…), et un libellé différent entre serveur et
 * navigateur casse l'hydratation — piège déjà rencontré avec l'indicatif
 * téléphonique (`ChampTelephone`). Elles en sont issues (pays de
 * `libphonenumber-js`, noms ICU de Node), avec quelques usages retouchés pour
 * un forum africain francophone : « République démocratique du Congo » et
 * « Congo » plutôt que « Congo-Kinshasa » et « Congo-Brazzaville »,
 * « Palestine », apostrophe droite dans « Côte d'Ivoire ».
 *
 * Sans dépendance : sert aux formulaires comme au serveur.
 */

export type Langue3 = "fr" | "en" | "pt";

export interface Pays {
  /** Code ISO 3166-1 alpha-2. */
  code: string;
  fr: string;
  en: string;
  pt: string;
}

/** Code, nom français, anglais, portugais — trié par nom français. */
const DONNEES: readonly (readonly [string, string, string, string])[] = [
  ["AF", "Afghanistan", "Afghanistan", "Afeganistão"],
  ["ZA", "Afrique du Sud", "South Africa", "África do Sul"],
  ["AL", "Albanie", "Albania", "Albânia"],
  ["DZ", "Algérie", "Algeria", "Argélia"],
  ["DE", "Allemagne", "Germany", "Alemanha"],
  ["AD", "Andorre", "Andorra", "Andorra"],
  ["AO", "Angola", "Angola", "Angola"],
  ["AI", "Anguilla", "Anguilla", "Anguila"],
  ["AG", "Antigua-et-Barbuda", "Antigua & Barbuda", "Antígua e Barbuda"],
  ["SA", "Arabie saoudite", "Saudi Arabia", "Arábia Saudita"],
  ["AR", "Argentine", "Argentina", "Argentina"],
  ["AM", "Arménie", "Armenia", "Armênia"],
  ["AW", "Aruba", "Aruba", "Aruba"],
  ["AU", "Australie", "Australia", "Austrália"],
  ["AT", "Autriche", "Austria", "Áustria"],
  ["AZ", "Azerbaïdjan", "Azerbaijan", "Azerbaijão"],
  ["BS", "Bahamas", "Bahamas", "Bahamas"],
  ["BH", "Bahreïn", "Bahrain", "Barein"],
  ["BD", "Bangladesh", "Bangladesh", "Bangladesh"],
  ["BB", "Barbade", "Barbados", "Barbados"],
  ["BE", "Belgique", "Belgium", "Bélgica"],
  ["BZ", "Belize", "Belize", "Belize"],
  ["BJ", "Bénin", "Benin", "Benin"],
  ["BM", "Bermudes", "Bermuda", "Bermudas"],
  ["BT", "Bhoutan", "Bhutan", "Butão"],
  ["BY", "Biélorussie", "Belarus", "Bielorrússia"],
  ["BO", "Bolivie", "Bolivia", "Bolívia"],
  ["BA", "Bosnie-Herzégovine", "Bosnia & Herzegovina", "Bósnia e Herzegovina"],
  ["BW", "Botswana", "Botswana", "Botsuana"],
  ["BR", "Brésil", "Brazil", "Brasil"],
  ["BN", "Brunei", "Brunei", "Brunei"],
  ["BG", "Bulgarie", "Bulgaria", "Bulgária"],
  ["BF", "Burkina Faso", "Burkina Faso", "Burquina Faso"],
  ["BI", "Burundi", "Burundi", "Burundi"],
  ["KH", "Cambodge", "Cambodia", "Camboja"],
  ["CM", "Cameroun", "Cameroon", "Camarões"],
  ["CA", "Canada", "Canada", "Canadá"],
  ["CV", "Cap-Vert", "Cape Verde", "Cabo Verde"],
  ["CL", "Chili", "Chile", "Chile"],
  ["CN", "Chine", "China", "China"],
  ["CY", "Chypre", "Cyprus", "Chipre"],
  ["CO", "Colombie", "Colombia", "Colômbia"],
  ["KM", "Comores", "Comoros", "Comores"],
  ["CG", "Congo", "Republic of the Congo", "República do Congo"],
  ["KP", "Corée du Nord", "North Korea", "Coreia do Norte"],
  ["KR", "Corée du Sud", "South Korea", "Coreia do Sul"],
  ["CR", "Costa Rica", "Costa Rica", "Costa Rica"],
  ["CI", "Côte d'Ivoire", "Côte d'Ivoire", "Costa do Marfim"],
  ["HR", "Croatie", "Croatia", "Croácia"],
  ["CU", "Cuba", "Cuba", "Cuba"],
  ["CW", "Curaçao", "Curaçao", "Curaçao"],
  ["DK", "Danemark", "Denmark", "Dinamarca"],
  ["DJ", "Djibouti", "Djibouti", "Djibuti"],
  ["DM", "Dominique", "Dominica", "Dominica"],
  ["EG", "Égypte", "Egypt", "Egito"],
  ["AE", "Émirats arabes unis", "United Arab Emirates", "Emirados Árabes Unidos"],
  ["EC", "Équateur", "Ecuador", "Equador"],
  ["ER", "Érythrée", "Eritrea", "Eritreia"],
  ["ES", "Espagne", "Spain", "Espanha"],
  ["EE", "Estonie", "Estonia", "Estônia"],
  ["SZ", "Eswatini", "Eswatini", "Essuatíni"],
  ["VA", "État de la Cité du Vatican", "Vatican City", "Cidade do Vaticano"],
  ["US", "États-Unis", "United States", "Estados Unidos"],
  ["ET", "Éthiopie", "Ethiopia", "Etiópia"],
  ["FJ", "Fidji", "Fiji", "Fiji"],
  ["FI", "Finlande", "Finland", "Finlândia"],
  ["FR", "France", "France", "França"],
  ["GA", "Gabon", "Gabon", "Gabão"],
  ["GM", "Gambie", "Gambia", "Gâmbia"],
  ["GE", "Géorgie", "Georgia", "Geórgia"],
  ["GH", "Ghana", "Ghana", "Gana"],
  ["GI", "Gibraltar", "Gibraltar", "Gibraltar"],
  ["GR", "Grèce", "Greece", "Grécia"],
  ["GD", "Grenade", "Grenada", "Granada"],
  ["GL", "Groenland", "Greenland", "Groenlândia"],
  ["GP", "Guadeloupe", "Guadeloupe", "Guadalupe"],
  ["GU", "Guam", "Guam", "Guam"],
  ["GT", "Guatemala", "Guatemala", "Guatemala"],
  ["GG", "Guernesey", "Guernsey", "Guernsey"],
  ["GN", "Guinée", "Guinea", "Guiné"],
  ["GQ", "Guinée équatoriale", "Equatorial Guinea", "Guiné Equatorial"],
  ["GW", "Guinée-Bissau", "Guinea-Bissau", "Guiné-Bissau"],
  ["GY", "Guyana", "Guyana", "Guiana"],
  ["GF", "Guyane française", "French Guiana", "Guiana Francesa"],
  ["HT", "Haïti", "Haiti", "Haiti"],
  ["HN", "Honduras", "Honduras", "Honduras"],
  ["HU", "Hongrie", "Hungary", "Hungria"],
  ["CX", "Île Christmas", "Christmas Island", "Ilha Christmas"],
  ["IM", "Île de Man", "Isle of Man", "Ilha de Man"],
  ["NF", "Île Norfolk", "Norfolk Island", "Ilha Norfolk"],
  ["AX", "Îles Åland", "Åland Islands", "Ilhas Aland"],
  ["KY", "Îles Caïmans", "Cayman Islands", "Ilhas Cayman"],
  ["CC", "Îles Cocos", "Cocos (Keeling) Islands", "Ilhas Cocos (Keeling)"],
  ["CK", "Îles Cook", "Cook Islands", "Ilhas Cook"],
  ["FO", "Îles Féroé", "Faroe Islands", "Ilhas Faroé"],
  ["FK", "Îles Malouines", "Falkland Islands", "Ilhas Malvinas"],
  ["MP", "Îles Mariannes du Nord", "Northern Mariana Islands", "Ilhas Marianas do Norte"],
  ["MH", "Îles Marshall", "Marshall Islands", "Ilhas Marshall"],
  ["SB", "Îles Salomon", "Solomon Islands", "Ilhas Salomão"],
  ["TC", "Îles Turques-et-Caïques", "Turks & Caicos Islands", "Ilhas Turcas e Caicos"],
  ["VG", "Îles Vierges britanniques", "British Virgin Islands", "Ilhas Virgens Britânicas"],
  ["VI", "Îles Vierges des États-Unis", "U.S. Virgin Islands", "Ilhas Virgens Americanas"],
  ["IN", "Inde", "India", "Índia"],
  ["ID", "Indonésie", "Indonesia", "Indonésia"],
  ["IQ", "Irak", "Iraq", "Iraque"],
  ["IR", "Iran", "Iran", "Irã"],
  ["IE", "Irlande", "Ireland", "Irlanda"],
  ["IS", "Islande", "Iceland", "Islândia"],
  ["IL", "Israël", "Israel", "Israel"],
  ["IT", "Italie", "Italy", "Itália"],
  ["JM", "Jamaïque", "Jamaica", "Jamaica"],
  ["JP", "Japon", "Japan", "Japão"],
  ["JE", "Jersey", "Jersey", "Jersey"],
  ["JO", "Jordanie", "Jordan", "Jordânia"],
  ["KZ", "Kazakhstan", "Kazakhstan", "Cazaquistão"],
  ["KE", "Kenya", "Kenya", "Quênia"],
  ["KG", "Kirghizstan", "Kyrgyzstan", "Quirguistão"],
  ["KI", "Kiribati", "Kiribati", "Quiribati"],
  ["XK", "Kosovo", "Kosovo", "Kosovo"],
  ["KW", "Koweït", "Kuwait", "Kuwait"],
  ["RE", "La Réunion", "Réunion", "Reunião"],
  ["LA", "Laos", "Laos", "Laos"],
  ["LS", "Lesotho", "Lesotho", "Lesoto"],
  ["LV", "Lettonie", "Latvia", "Letônia"],
  ["LB", "Liban", "Lebanon", "Líbano"],
  ["LR", "Liberia", "Liberia", "Libéria"],
  ["LY", "Libye", "Libya", "Líbia"],
  ["LI", "Liechtenstein", "Liechtenstein", "Liechtenstein"],
  ["LT", "Lituanie", "Lithuania", "Lituânia"],
  ["LU", "Luxembourg", "Luxembourg", "Luxemburgo"],
  ["MK", "Macédoine du Nord", "North Macedonia", "Macedônia do Norte"],
  ["MG", "Madagascar", "Madagascar", "Madagascar"],
  ["MY", "Malaisie", "Malaysia", "Malásia"],
  ["MW", "Malawi", "Malawi", "Malaui"],
  ["MV", "Maldives", "Maldives", "Maldivas"],
  ["ML", "Mali", "Mali", "Mali"],
  ["MT", "Malte", "Malta", "Malta"],
  ["MA", "Maroc", "Morocco", "Marrocos"],
  ["MQ", "Martinique", "Martinique", "Martinica"],
  ["MU", "Maurice", "Mauritius", "Maurício"],
  ["MR", "Mauritanie", "Mauritania", "Mauritânia"],
  ["YT", "Mayotte", "Mayotte", "Mayotte"],
  ["MX", "Mexique", "Mexico", "México"],
  ["FM", "Micronésie", "Micronesia", "Micronésia"],
  ["MD", "Moldavie", "Moldova", "Moldávia"],
  ["MC", "Monaco", "Monaco", "Mônaco"],
  ["MN", "Mongolie", "Mongolia", "Mongólia"],
  ["ME", "Monténégro", "Montenegro", "Montenegro"],
  ["MS", "Montserrat", "Montserrat", "Montserrat"],
  ["MZ", "Mozambique", "Mozambique", "Moçambique"],
  ["MM", "Myanmar (Birmanie)", "Myanmar (Burma)", "Mianmar (Birmânia)"],
  ["NA", "Namibie", "Namibia", "Namíbia"],
  ["NR", "Nauru", "Nauru", "Nauru"],
  ["NP", "Népal", "Nepal", "Nepal"],
  ["NI", "Nicaragua", "Nicaragua", "Nicarágua"],
  ["NE", "Niger", "Niger", "Níger"],
  ["NG", "Nigeria", "Nigeria", "Nigéria"],
  ["NU", "Niue", "Niue", "Niue"],
  ["NO", "Norvège", "Norway", "Noruega"],
  ["NC", "Nouvelle-Calédonie", "New Caledonia", "Nova Caledônia"],
  ["NZ", "Nouvelle-Zélande", "New Zealand", "Nova Zelândia"],
  ["OM", "Oman", "Oman", "Omã"],
  ["UG", "Ouganda", "Uganda", "Uganda"],
  ["UZ", "Ouzbékistan", "Uzbekistan", "Uzbequistão"],
  ["PK", "Pakistan", "Pakistan", "Paquistão"],
  ["PW", "Palaos", "Palau", "Palau"],
  ["PS", "Palestine", "Palestine", "Palestina"],
  ["PA", "Panama", "Panama", "Panamá"],
  ["PG", "Papouasie-Nouvelle-Guinée", "Papua New Guinea", "Papua-Nova Guiné"],
  ["PY", "Paraguay", "Paraguay", "Paraguai"],
  ["NL", "Pays-Bas", "Netherlands", "Países Baixos"],
  ["BQ", "Pays-Bas caribéens", "Caribbean Netherlands", "Países Baixos Caribenhos"],
  ["PE", "Pérou", "Peru", "Peru"],
  ["PH", "Philippines", "Philippines", "Filipinas"],
  ["PL", "Pologne", "Poland", "Polônia"],
  ["PF", "Polynésie française", "French Polynesia", "Polinésia Francesa"],
  ["PR", "Porto Rico", "Puerto Rico", "Porto Rico"],
  ["PT", "Portugal", "Portugal", "Portugal"],
  ["QA", "Qatar", "Qatar", "Catar"],
  ["HK", "R.A.S. chinoise de Hong Kong", "Hong Kong SAR China", "Hong Kong, RAE da China"],
  ["MO", "R.A.S. chinoise de Macao", "Macao SAR China", "Macau, RAE da China"],
  ["CF", "République centrafricaine", "Central African Republic", "República Centro-Africana"],
  [
    "CD",
    "République démocratique du Congo",
    "Democratic Republic of the Congo",
    "República Democrática do Congo",
  ],
  ["DO", "République dominicaine", "Dominican Republic", "República Dominicana"],
  ["RO", "Roumanie", "Romania", "Romênia"],
  ["GB", "Royaume-Uni", "United Kingdom", "Reino Unido"],
  ["RU", "Russie", "Russia", "Rússia"],
  ["RW", "Rwanda", "Rwanda", "Ruanda"],
  ["EH", "Sahara occidental", "Western Sahara", "Saara Ocidental"],
  ["BL", "Saint-Barthélemy", "St. Barthélemy", "São Bartolomeu"],
  ["KN", "Saint-Christophe-et-Niévès", "St. Kitts & Nevis", "São Cristóvão e Névis"],
  ["SM", "Saint-Marin", "San Marino", "San Marino"],
  ["MF", "Saint-Martin", "St. Martin", "São Martinho"],
  ["SX", "Saint-Martin (partie néerlandaise)", "Sint Maarten", "Sint Maarten"],
  ["PM", "Saint-Pierre-et-Miquelon", "St. Pierre & Miquelon", "São Pedro e Miquelão"],
  ["VC", "Saint-Vincent-et-les Grenadines", "St. Vincent & Grenadines", "São Vicente e Granadinas"],
  ["SH", "Sainte-Hélène", "St. Helena", "Santa Helena"],
  ["LC", "Sainte-Lucie", "St. Lucia", "Santa Lúcia"],
  ["SV", "Salvador", "El Salvador", "El Salvador"],
  ["WS", "Samoa", "Samoa", "Samoa"],
  ["AS", "Samoa américaines", "American Samoa", "Samoa Americana"],
  ["ST", "Sao Tomé-et-Principe", "São Tomé & Príncipe", "São Tomé e Príncipe"],
  ["SN", "Sénégal", "Senegal", "Senegal"],
  ["RS", "Serbie", "Serbia", "Sérvia"],
  ["SC", "Seychelles", "Seychelles", "Seicheles"],
  ["SL", "Sierra Leone", "Sierra Leone", "Serra Leoa"],
  ["SG", "Singapour", "Singapore", "Singapura"],
  ["SK", "Slovaquie", "Slovakia", "Eslováquia"],
  ["SI", "Slovénie", "Slovenia", "Eslovênia"],
  ["SO", "Somalie", "Somalia", "Somália"],
  ["SD", "Soudan", "Sudan", "Sudão"],
  ["SS", "Soudan du Sud", "South Sudan", "Sudão do Sul"],
  ["LK", "Sri Lanka", "Sri Lanka", "Sri Lanka"],
  ["SE", "Suède", "Sweden", "Suécia"],
  ["CH", "Suisse", "Switzerland", "Suíça"],
  ["SR", "Suriname", "Suriname", "Suriname"],
  ["SJ", "Svalbard et Jan Mayen", "Svalbard & Jan Mayen", "Svalbard e Jan Mayen"],
  ["SY", "Syrie", "Syria", "Síria"],
  ["TJ", "Tadjikistan", "Tajikistan", "Tadjiquistão"],
  ["TW", "Taïwan", "Taiwan", "Taiwan"],
  ["TZ", "Tanzanie", "Tanzania", "Tanzânia"],
  ["TD", "Tchad", "Chad", "Chade"],
  ["CZ", "Tchéquie", "Czechia", "Tchéquia"],
  [
    "IO",
    "Territoire britannique de l'océan Indien",
    "British Indian Ocean Territory",
    "Território Britânico do Oceano Índico",
  ],
  ["TH", "Thaïlande", "Thailand", "Tailândia"],
  ["TL", "Timor oriental", "Timor-Leste", "Timor-Leste"],
  ["TG", "Togo", "Togo", "Togo"],
  ["TK", "Tokelau", "Tokelau", "Tokelau"],
  ["TO", "Tonga", "Tonga", "Tonga"],
  ["TT", "Trinité-et-Tobago", "Trinidad & Tobago", "Trinidad e Tobago"],
  ["TN", "Tunisie", "Tunisia", "Tunísia"],
  ["TM", "Turkménistan", "Turkmenistan", "Turcomenistão"],
  ["TR", "Turquie", "Türkiye", "Turquia"],
  ["TV", "Tuvalu", "Tuvalu", "Tuvalu"],
  ["UA", "Ukraine", "Ukraine", "Ucrânia"],
  ["UY", "Uruguay", "Uruguay", "Uruguai"],
  ["VU", "Vanuatu", "Vanuatu", "Vanuatu"],
  ["VE", "Venezuela", "Venezuela", "Venezuela"],
  ["VN", "Viêt Nam", "Vietnam", "Vietnã"],
  ["WF", "Wallis-et-Futuna", "Wallis & Futuna", "Wallis e Futuna"],
  ["YE", "Yémen", "Yemen", "Iêmen"],
  ["ZM", "Zambie", "Zambia", "Zâmbia"],
  ["ZW", "Zimbabwe", "Zimbabwe", "Zimbábue"],
];

export const PAYS: readonly Pays[] = DONNEES.map(([code, fr, en, pt]) => ({ code, fr, en, pt }));

/**
 * Appellations courantes absentes des noms officiels : sigles, anciens noms,
 * codes ISO à trois lettres des pays les plus représentés au Forum.
 */
const ALIAS: Record<string, string> = {
  burkina: "BF",
  guineeconakry: "GN",
  conakry: "GN",
  centrafrique: "CF",
  rca: "CF",
  rdc: "CD",
  rdcongo: "CD",
  congokinshasa: "CD",
  congodemocratique: "CD",
  zaire: "CD",
  drc: "CD",
  congobrazzaville: "CG",
  republiqueducongo: "CG",
  ivorycoast: "CI",
  usa: "US",
  etatsunisdamerique: "US",
  unitedstatesofamerica: "US",
  uk: "GB",
  angleterre: "GB",
  england: "GB",
  grandebretagne: "GB",
  greatbritain: "GB",
  hollande: "NL",
  holland: "NL",
  swaziland: "SZ",
  macedoine: "MK",
  birmanie: "MM",
  burma: "MM",
  coreedusud: "KR",
  southkorea: "KR",
  coreedunord: "KP",
  northkorea: "KP",
  russie: "RU",
  eau: "AE",
  uae: "AE",
  tchequie: "CZ",
  republiquetcheque: "CZ",
  czechrepublic: "CZ",
  vatican: "VA",
  territoirespalestiniens: "PS",
  palestinianterritories: "PS",
  sen: "SN",
  civ: "CI",
  mli: "ML",
  bfa: "BF",
  gin: "GN",
  ner: "NE",
  tgo: "TG",
  ben: "BJ",
  cmr: "CM",
  mrt: "MR",
  gmb: "GM",
  gnb: "GW",
  cpv: "CV",
  tcd: "TD",
  cod: "CD",
  cog: "CG",
  gab: "GA",
  nga: "NG",
  gha: "GH",
  mar: "MA",
  tun: "TN",
  dza: "DZ",
  fra: "FR",
  bel: "BE",
  che: "CH",
  can: "CA",
};

/** Clé de comparaison : sans accents, ponctuation, espaces ni casse. */
export function cleDePays(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const PAR_CODE = new Map(PAYS.map((pays) => [pays.code, pays]));

const INDEX: Map<string, Pays> = (() => {
  const index = new Map<string, Pays>();
  for (const pays of PAYS) {
    for (const forme of [pays.code, pays.fr, pays.en, pays.pt]) {
      const cle = cleDePays(forme);
      if (cle && !index.has(cle)) index.set(cle, pays);
    }
  }
  for (const [alias, code] of Object.entries(ALIAS)) {
    const pays = PAR_CODE.get(code);
    if (pays && !index.has(alias)) index.set(alias, pays);
  }
  return index;
})();

/** Pays reconnu dans une saisie libre (« senegal », « SN », « RDC »…), ou `null`. */
export function trouverPays(saisie: string | null | undefined): Pays | null {
  const cle = cleDePays(saisie ?? "");
  return cle ? (INDEX.get(cle) ?? null) : null;
}

/**
 * Valeur à enregistrer : le nom français du pays reconnu ; une saisie non
 * reconnue est gardée telle quelle (débarrassée de ses espaces), plutôt que
 * perdue — elle apparaîtra dans l'outil d'harmonisation.
 */
export function normaliserPays(saisie: string | null | undefined): string {
  const pays = trouverPays(saisie);
  return pays ? pays.fr : (saisie ?? "").trim();
}

/** Vrai si la valeur est exactement un nom de référence (déjà harmonisée). */
export function estPaysDeReference(valeur: string | null | undefined): boolean {
  const pays = trouverPays(valeur);
  return pays !== null && pays.fr === valeur;
}

/** Nom d'un pays enregistré, dans la langue demandée ; une valeur inconnue est rendue telle quelle. */
export function libellePays(valeur: string | null | undefined, langue: Langue3 = "fr"): string {
  const pays = trouverPays(valeur);
  return pays ? pays[langue] : (valeur ?? "");
}
