// -----------------------------------------------------------------------------
// Texts the integration sends to Gladys outside the widget (src/widgets.js):
// connection status, errors, the players text, the "Test the connection"
// report, scene action errors. Four languages, the four of the Gladys
// interface; German says "du", Spanish "usted". test/i18n.test.js checks
// every table.
// -----------------------------------------------------------------------------

import { ERROR_KINDS } from './query.js';

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

export const CONNECTION_TEXT = {
  noServer: {
    en: 'Choose the game and enter the address of your server in the configuration.',
    fr: "Choisissez le jeu et saisissez l'adresse de votre serveur dans la configuration.",
    de: 'Wähle das Spiel und gib die Adresse deines Servers in der Konfiguration ein.',
    es: 'Elija el juego e introduzca la dirección de su servidor en la configuración.',
  },
};

// A configuration slot that cannot be read (src/config.js `invalid`).
export const INVALID_TEXT = {
  address: {
    en: 'address not understood, e.g. 192.168.1.20 or game.example.com:2457',
    fr: 'adresse incomprise, ex. 192.168.1.20 ou game.example.com:2457',
    de: 'Adresse nicht verstanden, z. B. 192.168.1.20 oder game.example.com:2457',
    es: 'dirección no válida, p. ej. 192.168.1.20 o game.example.com:2457',
  },
  game: {
    en: 'unknown GameDig type, see its games list',
    fr: 'type GameDig inconnu, voir sa liste des jeux',
    de: 'unbekannter GameDig-Typ, siehe seine Spieleliste',
    es: 'tipo GameDig desconocido, consulte su lista de juegos',
  },
};

// One short explanation per error kind (src/query.js).
export const ERROR_TEXT = {
  [ERROR_KINDS.NO_ANSWER]: {
    en: 'does not answer (game, port, query enabled?)',
    fr: 'ne répond pas (jeu, port, requêtes activées ?)',
    de: 'antwortet nicht (Spiel, Port, Abfragen aktiv?)',
    es: 'no responde (¿juego, puerto, consultas activadas?)',
  },
  [ERROR_KINDS.DNS]: {
    en: 'name not found',
    fr: 'nom introuvable',
    de: 'Name nicht gefunden',
    es: 'nombre no encontrado',
  },
};

// The "Players" feature (src/devices.js).
export const PLAYERS_TEXT = {
  en: {
    nobody: 'Nobody',
    offline: 'Server offline',
    count: (count) => `${count} player(s), names not given by the game`,
    more: (count) => `and ${count} more`,
  },
  fr: {
    nobody: 'Personne',
    offline: 'Serveur hors ligne',
    count: (count) => `${count} joueur(s), noms non fournis par le jeu`,
    more: (count) => `et ${count} autre(s)`,
  },
  de: {
    nobody: 'Niemand',
    offline: 'Server offline',
    count: (count) => `${count} Spieler, Namen vom Spiel nicht geliefert`,
    more: (count) => `und ${count} weitere`,
  },
  es: {
    nobody: 'Nadie',
    offline: 'Servidor fuera de línea',
    count: (count) => `${count} jugador(es), nombres no facilitados por el juego`,
    more: (count) => `y ${count} más`,
  },
};

// The "Test the connection" report, one line per server.
export const REPORT_TEXT = {
  en: {
    players: (online, max) => `${online}/${max} players`,
    latency: (ms) => `${ms} ms`,
    map: (map) => `map ${map}`,
  },
  fr: {
    players: (online, max) => `${online}/${max} joueurs`,
    latency: (ms) => `${ms} ms`,
    map: (map) => `carte ${map}`,
  },
  de: {
    players: (online, max) => `${online}/${max} Spieler`,
    latency: (ms) => `${ms} ms`,
    map: (map) => `Karte ${map}`,
  },
  es: {
    players: (online, max) => `${online}/${max} jugadores`,
    latency: (ms) => `${ms} ms`,
    map: (map) => `mapa ${map}`,
  },
};

// Errors of the scene action (shown in Gladys).
export const ACTION_TEXT = {
  noServer: {
    en: 'No game server is configured.',
    fr: "Aucun serveur de jeu n'est configuré.",
    de: 'Kein Spieleserver ist konfiguriert.',
    es: 'No hay ningún servidor de juego configurado.',
  },
  unknownServer: {
    en: 'This game server is no longer in the configuration.',
    fr: "Ce serveur de jeu n'est plus dans la configuration.",
    de: 'Dieser Spieleserver ist nicht mehr in der Konfiguration.',
    es: 'Este servidor de juego ya no está en la configuración.',
  },
};

export const LANGUAGE_FALLBACK = 'en';

/** "Name: text", with the space French puts before a colon. */
export const labelled = (name, text, language) =>
  `${name}${language === 'fr' ? ' : ' : ': '}${text}`;
export const pick = (text, language) => text[language] ?? text[LANGUAGE_FALLBACK];
