// -----------------------------------------------------------------------------
// Reading a game server through GameDig, and what the integration keeps of
// its answer.
//
// GameDig speaks each game's own query protocol (Valve A2S, Quake 3, GameSpy,
// HTTP APIs…), most of them over UDP, and tries the query port of the game
// (game port + offset) before the port typed. It reports a failure as one
// "Failed all N attempts" error, whatever the cause: no answer, wrong port,
// wrong game, name not found. The integration only tells them apart from the
// DNS error code it carries.
// -----------------------------------------------------------------------------

import { GameDig } from 'gamedig';
import { secretOptions } from './games.js';

export const ERROR_KINDS = Object.freeze({
  NO_ANSWER: 'no_answer',
  DNS: 'dns',
});

export class QueryError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'QueryError';
    this.kind = kind;
  }
}

// One runner for the whole process: GameDig shares a single UDP socket
// between the queries, and remembers the port that answered for each server.
let runner = null;

/**
 * Query one server.
 * @param {{ type: string, address: { host: string, port: number|null }, secret: string|null }} server
 * @param {{ timeoutMs: number, attempts: number }} options
 * @returns {Promise<object>} the reading (readState)
 */
export async function queryServer(server, { timeoutMs, attempts }) {
  runner ??= new GameDig();
  const options = {
    type: server.type,
    host: server.address.host,
    maxRetries: attempts,
    socketTimeout: timeoutMs,
    // A Valve query is up to three exchanges (info, players, challenge).
    attemptTimeout: timeoutMs * 4,
    ...secretOptions(server.type, server.secret),
  };
  if (server.address.port !== null) {
    options.port = server.address.port;
  }
  let state;
  try {
    state = await runner.query(options);
  } catch (err) {
    throw toQueryError(err, server.address.host);
  }
  return readState(state);
}

/** A GameDig failure, without its stack of attempts (it may hold a URL with a token). */
export function toQueryError(err, host) {
  const details = String(err?.stack ?? err?.message ?? err);
  if (/ENOTFOUND|EAI_AGAIN|ENODATA|Failed to resolve/u.test(details)) {
    return new QueryError(ERROR_KINDS.DNS, `${host}: name not found`);
  }
  return new QueryError(ERROR_KINDS.NO_ANSWER, `${host}: no answer to the game query`);
}

const cleanText = (value) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
        .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim()
    : '';

const count = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
};

/**
 * What the integration keeps of a GameDig answer.
 *
 * Players online counts people, not bots. The protocols disagree on
 * `numplayers`: Valve and Quake count the bots in it (and list them in
 * `bots`), others count only people. When `numplayers` covers the people and
 * the bots listed, the bots are taken out of it.
 *
 * Names are known when every player online has one, and only once each:
 * Counter-Strike 2 gives none, Valheim crossplay and DayZ give empty ones.
 */
export function readState(state = {}) {
  const players = Array.isArray(state.players) ? state.players : [];
  const bots = Array.isArray(state.bots) ? state.bots.length : 0;
  const reported = count(state.numplayers);
  const online =
    reported >= players.length + bots && bots > 0
      ? reported - bots
      : Math.max(reported, players.length);
  const names = players.map((player) => cleanText(player?.name)).filter(Boolean);
  const unique = new Set(names);
  return {
    name: cleanText(state.name),
    map: cleanText(state.map),
    version: cleanText(state.version),
    online,
    max: count(state.maxplayers),
    bots,
    players: [...unique],
    namesComplete: unique.size === names.length && names.length === online,
    password: state.password === true,
    latencyMs: Math.round(count(state.ping)),
  };
}
