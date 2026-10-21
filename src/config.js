// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Up to four servers, each in its own slot (game, address, name, secret).
// The slot number is the device identity: a game server has no stable id to
// use instead, and moving a server to a new address or a new game must not
// orphan its device and its history.
// -----------------------------------------------------------------------------

import { parseAddress } from './address.js';
import { OTHER_GAME, isKnownType } from './games.js';

export const LANGUAGES = ['en', 'fr', 'de', 'es'];
export const SLOTS = [1, 2, 3, 4];

// Reading intervals offered in the configuration, in seconds. A status query
// is a few small UDP packets: 30 s is harmless for any server.
export const POLL_INTERVALS = ['30', '60', '120', '300', '600'];
// Time to wait for each answer packet, in seconds (GameDig socketTimeout).
export const TIMEOUTS = ['2', '3', '5', '10'];
// Tries before a reading fails (GameDig maxRetries).
export const ATTEMPTS = ['1', '2', '3'];

export const DEFAULT_CONFIG = {
  server_1_game: 'valheim',
  server_1_type: '',
  server_1_address: '',
  server_1_name: '',
  server_1_secret: '',
  server_2_game: 'valheim',
  server_2_type: '',
  server_2_address: '',
  server_2_name: '',
  server_2_secret: '',
  server_3_game: 'valheim',
  server_3_type: '',
  server_3_address: '',
  server_3_name: '',
  server_3_secret: '',
  server_4_game: 'valheim',
  server_4_type: '',
  server_4_address: '',
  server_4_name: '',
  server_4_secret: '',
  poll_interval: '60',
  timeout: '3',
  attempts: '2',
  language: 'fr',
};

const MAX_NAME_LENGTH = 40;

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const text = (key) => (typeof source[key] === 'string' ? source[key].trim() : '');
  const pick = (key, list) => {
    const value = source[key] === undefined || source[key] === null ? '' : String(source[key]);
    return list.includes(value) ? value : DEFAULT_CONFIG[key];
  };

  const servers = [];
  /** Slots that cannot be read: { slot, reason: 'address' | 'game' }. */
  const invalid = [];
  for (const slot of SLOTS) {
    const typed = text(`server_${slot}_address`);
    if (!typed) {
      continue;
    }
    const address = parseAddress(typed);
    if (!address) {
      invalid.push({ slot, reason: 'address' });
      continue;
    }
    // A game dropped from the list in a later version keeps working: any
    // GameDig id is accepted. Empty: the default of the form.
    const game = text(`server_${slot}_game`) || DEFAULT_CONFIG[`server_${slot}_game`];
    const type = game === OTHER_GAME ? text(`server_${slot}_type`).toLowerCase() : game;
    if (!isKnownType(type)) {
      invalid.push({ slot, reason: 'game' });
      continue;
    }
    // A secret is kept as typed: spaces may be part of it.
    const secret = source[`server_${slot}_secret`];
    servers.push({
      slot,
      type,
      address,
      name: text(`server_${slot}_name`).slice(0, MAX_NAME_LENGTH) || null,
      secret: typeof secret === 'string' && secret !== '' ? secret : null,
    });
  }

  return {
    servers,
    invalid,
    pollIntervalMs: Number(pick('poll_interval', POLL_INTERVALS)) * 1000,
    timeoutMs: Number(pick('timeout', TIMEOUTS)) * 1000,
    attempts: Number(pick('attempts', ATTEMPTS)),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
