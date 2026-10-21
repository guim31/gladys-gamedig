#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Read-only probe of a real game server, with the integration's own code:
// what Gladys would read, without Gladys. One status query, nothing changed
// on the server.
//
//   node scripts/probe.mjs <gamedig-type> <host[:port]>
//   GAMEDIG_SECRET=... node scripts/probe.mjs palworld 192.0.2.10:8212
//   node scripts/probe.mjs --raw openarena 192.0.2.10   # the GameDig answer too
//
// Without --raw, prints counts and formats, never a secret nor player names
// (only how many were read), so the output can be pasted in an issue.
// -----------------------------------------------------------------------------

import { GameDig } from 'gamedig';
import { parseAddress } from '../src/address.js';
import { isKnownType, secretOptions } from '../src/games.js';
import { queryServer } from '../src/query.js';

const args = process.argv.slice(2);
const raw = args[0] === '--raw';
const [type, typed] = raw ? args.slice(1) : args;
const address = parseAddress(typed ?? '');
if (!isKnownType(type) || !address) {
  console.error('usage: node scripts/probe.mjs [--raw] <gamedig-type> <host[:port]>');
  process.exit(2);
}
const server = { type, address, secret: process.env.GAMEDIG_SECRET || null };
const options = { timeoutMs: 3000, attempts: 2 };

try {
  const status = await queryServer(server, options);
  console.log(
    JSON.stringify(
      {
        online: status.online,
        max: status.max,
        bots: status.bots,
        namesRead: status.players.length,
        namesComplete: status.namesComplete,
        mapLength: status.map.length,
        nameLength: status.name.length,
        version: status.version,
        password: status.password,
        latencyMs: status.latencyMs,
      },
      null,
      2,
    ),
  );
  if (raw) {
    const answer = await new GameDig().query({
      type,
      host: address.host,
      ...(address.port === null ? {} : { port: address.port }),
      ...secretOptions(type, server.secret),
    });
    console.log(JSON.stringify(answer, null, 2));
  }
} catch (err) {
  console.error(`${err.name}: ${err.message}${err.kind ? ` (${err.kind})` : ''}`);
  process.exit(1);
}
