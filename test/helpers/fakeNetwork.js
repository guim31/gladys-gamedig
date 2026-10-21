// -----------------------------------------------------------------------------
// Fake game servers on a fake network, for the hub tests. They answer with a
// real GameDig recording (test/fixtures/real, an OpenArena 0.8.8 server in
// Docker) where the players are swapped, and the answer goes through the
// same reading code as production (src/query.js readState).
//
// Players are written as GameDig's quake3 protocol writes them (a ping above
// 0 for people, bots in `bots`, `numplayers` counting both). `names: false`
// plays a game that only gives a count (Counter-Strike 2).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { ERROR_KINDS, QueryError, readState } from '../../src/query.js';

export const realAnswer = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/real/${name}.json`, import.meta.url), 'utf8'));

export class FakeServer {
  /**
   * @param {object} [options]
   * @param {string} [options.fixture] a recording of test/fixtures/real
   * @param {string[]} [options.players] who is playing
   * @param {string[]} [options.bots]
   * @param {boolean} [options.names] false: the game gives no names
   * @param {number} [options.max] player slots
   */
  constructor({
    fixture = 'openarena-0.8.8-empty',
    players = [],
    bots = [],
    names = true,
    max,
    latencyMs = 4,
  } = {}) {
    this.answer = realAnswer(fixture);
    this.players = players;
    this.bots = bots;
    this.names = names;
    this.max = max;
    this.latencyMs = latencyMs;
    this.online = true;
    this.queries = 0;
    this.lastOptions = null;
  }

  /** The GameDig answer, as its quake3 protocol builds it. */
  gamedigAnswer() {
    const answer = structuredClone(this.answer);
    const player = (name) => ({ name, raw: { frags: 0, ping: 48 } });
    answer.players = this.names ? this.players.map(player) : [];
    answer.bots = this.bots.map((name) => ({ name, raw: { frags: 0, ping: 0 } }));
    answer.numplayers = this.players.length + this.bots.length;
    if (this.max !== undefined) {
      answer.maxplayers = String(this.max);
    }
    answer.ping = this.latencyMs;
    return answer;
  }
}

/**
 * @param {Record<string, FakeServer>} servers by "host" or "host:port"
 */
export function createNetwork(servers) {
  const find = (server) => {
    const { host, port } = server.address;
    return servers[port === null ? host : `${host}:${port}`] ?? null;
  };
  return {
    servers,
    async query(server, options) {
      const fake = find(server);
      if (!fake || !fake.online) {
        throw new QueryError(
          ERROR_KINDS.NO_ANSWER,
          `${server.address.host}: no answer to the game query`,
        );
      }
      fake.queries += 1;
      fake.lastOptions = options;
      return readState(fake.gamedigAnswer());
    },
  };
}
