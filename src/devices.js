// -----------------------------------------------------------------------------
// One Gladys device per configured game server.
//
// Identity: the configuration slot (1 to 4), not the address nor the game
// (see src/config.js). Features (category/type couples of the core table, see
// test/gladys-rules.test.js):
//   - online: input/binary, 1 when the server answers the query, 0 once it
//     failed twice in a row (one lost UDP packet is not an outage);
//   - players online (people, bots left out), player slots:
//     counter-sensor/integer;
//   - players: text/text, who is playing when the game tells, else how many;
//   - map, server name, version: text/text, only once the game has given one
//     (Mumble has no map, many games no version): a feature that never
//     receives a value would show "no recent value" forever;
//   - latency: duration/integer, in milliseconds, of the query.
//
// The devices are published with should_poll: false: the integration reads
// the servers on its own timer (src/hub.js), Gladys never polls them
// (GladysAssistant/Gladys#3198).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { formatAddress } from './address.js';
import { gameLabel } from './games.js';
import { PLAYERS_TEXT, pick } from './texts.js';

export const DEVICE_TYPE = 'server';
export const ADDRESS_PARAM = 'GAME_ADDRESS';
export const TYPE_PARAM = 'GAMEDIG_TYPE';

// Suffixes of the feature external ids: permanent once published.
export const FEATURE_KEYS = Object.freeze({
  ONLINE: 'online',
  PLAYERS_ONLINE: 'players_online',
  PLAYERS_MAX: 'players_max',
  PLAYERS: 'players',
  MAP: 'map',
  SERVER_NAME: 'server_name',
  VERSION: 'version',
  LATENCY: 'latency',
});

// The text features a game may not give: published once it has.
export const OPTIONAL_KEYS = [FEATURE_KEYS.MAP, FEATURE_KEYS.SERVER_NAME, FEATURE_KEYS.VERSION];

// Feature names, in the language chosen in the configuration (Gladys does not
// tell a device integration the user's language). Frozen at creation in Gladys.
export const NAMES = {
  en: {
    [FEATURE_KEYS.ONLINE]: 'Online',
    [FEATURE_KEYS.PLAYERS_ONLINE]: 'Players online',
    [FEATURE_KEYS.PLAYERS_MAX]: 'Player slots',
    [FEATURE_KEYS.PLAYERS]: 'Players',
    [FEATURE_KEYS.MAP]: 'Map',
    [FEATURE_KEYS.SERVER_NAME]: 'Server name',
    [FEATURE_KEYS.VERSION]: 'Version',
    [FEATURE_KEYS.LATENCY]: 'Ping',
  },
  fr: {
    [FEATURE_KEYS.ONLINE]: 'En ligne',
    [FEATURE_KEYS.PLAYERS_ONLINE]: 'Joueurs connectés',
    [FEATURE_KEYS.PLAYERS_MAX]: 'Places',
    [FEATURE_KEYS.PLAYERS]: 'Joueurs',
    [FEATURE_KEYS.MAP]: 'Carte',
    [FEATURE_KEYS.SERVER_NAME]: 'Nom du serveur',
    [FEATURE_KEYS.VERSION]: 'Version',
    [FEATURE_KEYS.LATENCY]: 'Ping',
  },
  de: {
    [FEATURE_KEYS.ONLINE]: 'Online',
    [FEATURE_KEYS.PLAYERS_ONLINE]: 'Spieler online',
    [FEATURE_KEYS.PLAYERS_MAX]: 'Spielerplätze',
    [FEATURE_KEYS.PLAYERS]: 'Spieler',
    [FEATURE_KEYS.MAP]: 'Karte',
    [FEATURE_KEYS.SERVER_NAME]: 'Servername',
    [FEATURE_KEYS.VERSION]: 'Version',
    [FEATURE_KEYS.LATENCY]: 'Ping',
  },
  es: {
    [FEATURE_KEYS.ONLINE]: 'En línea',
    [FEATURE_KEYS.PLAYERS_ONLINE]: 'Jugadores conectados',
    [FEATURE_KEYS.PLAYERS_MAX]: 'Plazas',
    [FEATURE_KEYS.PLAYERS]: 'Jugadores',
    [FEATURE_KEYS.MAP]: 'Mapa',
    [FEATURE_KEYS.SERVER_NAME]: 'Nombre del servidor',
    [FEATURE_KEYS.VERSION]: 'Versión',
    [FEATURE_KEYS.LATENCY]: 'Ping',
  },
};

// Display bounds (the core never applies them on write).
export const PLAYERS_DISPLAY_MAX = 10_000;
export const LATENCY_DISPLAY_MAX = 10_000;
// A text state longer than this is cut: the list of a full server.
export const MAX_TEXT_LENGTH = 250;

const text = (key) => ({
  key,
  definition: {
    category: DEVICE_FEATURE_CATEGORIES.TEXT,
    type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
    read_only: true,
    has_feedback: false,
    // Gladys keeps no history of a text; min/max are NOT NULL columns: 0/0.
    keep_history: false,
    min: 0,
    max: 0,
  },
});

const counter = (key) => ({
  key,
  definition: {
    category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
    type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
    read_only: true,
    has_feedback: false,
    keep_history: true,
    min: 0,
    max: PLAYERS_DISPLAY_MAX,
  },
});

// Order = display order in Gladys.
const FEATURES = [
  {
    key: FEATURE_KEYS.ONLINE,
    definition: {
      category: DEVICE_FEATURE_CATEGORIES.INPUT,
      type: DEVICE_FEATURE_TYPES.SENSOR.BINARY,
      read_only: true,
      has_feedback: false,
      keep_history: true,
      min: 0,
      max: 1,
    },
  },
  counter(FEATURE_KEYS.PLAYERS_ONLINE),
  counter(FEATURE_KEYS.PLAYERS_MAX),
  text(FEATURE_KEYS.PLAYERS),
  text(FEATURE_KEYS.MAP),
  text(FEATURE_KEYS.SERVER_NAME),
  text(FEATURE_KEYS.VERSION),
  {
    key: FEATURE_KEYS.LATENCY,
    definition: {
      category: DEVICE_FEATURE_CATEGORIES.DURATION,
      type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
      unit: DEVICE_FEATURE_UNITS.MILLISECONDS,
      read_only: true,
      has_feedback: false,
      keep_history: true,
      min: 0,
      max: LATENCY_DISPLAY_MAX,
    },
  },
];

const featuresOf = (seen) =>
  FEATURES.filter((feature) => !OPTIONAL_KEYS.includes(feature.key) || seen.has(feature.key));

/** External ids of a server's device and features. */
export const deviceIds = (gladys, slot) => gladys.externalIds(DEVICE_TYPE, String(slot));

/** The slot of a device external id, null when it is not one of ours. */
export function slotOf(gladys, externalId) {
  for (let slot = 1; slot <= 4; slot += 1) {
    if (deviceIds(gladys, slot).device === externalId) {
      return slot;
    }
  }
  return null;
}

/** The name shown for a server: the one typed in the configuration, else game and address. */
export const serverName = (server) =>
  server.name ?? `${gameLabel(server.type)} ${formatAddress(server.address)}`;

/**
 * The discovery payload of a server.
 * @param {object} gladys SDK client
 * @param {{ slot: number, type: string, address: object, name: string|null }} server
 * @param {Set<string>} seen the optional features the server has given a value for
 * @param {string} language feature names language
 */
export function buildDevice(gladys, server, seen = new Set(), language = 'fr') {
  const ids = deviceIds(gladys, server.slot);
  const names = NAMES[language] ?? NAMES.en;
  return {
    name: serverName(server),
    external_id: ids.device,
    should_poll: false,
    params: [
      { name: ADDRESS_PARAM, value: formatAddress(server.address) },
      { name: TYPE_PARAM, value: server.type },
    ],
    features: featuresOf(seen).map(({ key, definition }) => ({
      ...definition,
      name: names[key],
      external_id: ids.feature(key),
    })),
  };
}

export const cut = (value, max = MAX_TEXT_LENGTH) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

/** What the "Players" text says for a reading. */
export function playersText(status, language) {
  const words = pick(PLAYERS_TEXT, language);
  if (status.online === 0) {
    return words.nobody;
  }
  if (status.players.length === 0) {
    return words.count(status.online);
  }
  const list = status.players.join(', ');
  if (status.namesComplete) {
    return cut(list);
  }
  return cut(`${list} ${words.more(Math.max(0, status.online - status.players.length))}`);
}

/**
 * The value of every feature of a server record (null: nothing to publish).
 * `down` publishes the outage: offline, nobody playing; the slots, the map,
 * the name and the version keep their last value.
 * @param {object} record { server, status, reachable, down, seen }
 * @returns {Array<{ key: string, externalId: string, state?: number, text?: string }>}
 */
export function featureStates(gladys, record, language) {
  const ids = deviceIds(gladys, record.server.slot);
  const { status, down } = record;
  const live = record.reachable === true && status;
  const words = pick(PLAYERS_TEXT, language);
  const values = {
    [FEATURE_KEYS.ONLINE]: down ? 0 : live ? 1 : null,
    [FEATURE_KEYS.PLAYERS_ONLINE]: down
      ? 0
      : live
        ? Math.min(PLAYERS_DISPLAY_MAX, status.online)
        : null,
    [FEATURE_KEYS.PLAYERS_MAX]: status ? Math.min(PLAYERS_DISPLAY_MAX, status.max) : null,
    [FEATURE_KEYS.PLAYERS]: down ? words.offline : live ? playersText(status, language) : null,
    [FEATURE_KEYS.MAP]: status?.map ? cut(status.map) : null,
    [FEATURE_KEYS.SERVER_NAME]: status?.name ? cut(status.name) : null,
    [FEATURE_KEYS.VERSION]: status?.version ? cut(status.version) : null,
    [FEATURE_KEYS.LATENCY]: live ? Math.min(LATENCY_DISPLAY_MAX, status.latencyMs) : null,
  };
  return featuresOf(record.seen).map(({ key, definition }) => {
    const value = values[key];
    const entry = { key, externalId: ids.feature(key) };
    if (value === null || value === undefined) {
      return entry;
    }
    return definition.category === DEVICE_FEATURE_CATEGORIES.TEXT
      ? { ...entry, text: value }
      : { ...entry, state: value };
  });
}
