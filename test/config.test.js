import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('the defaults: no server, a reading a minute, 3 s, 2 attempts, French names', () => {
  assert.deepEqual(normalizeConfig(DEFAULT_CONFIG), {
    servers: [],
    invalid: [],
    pollIntervalMs: 60_000,
    timeoutMs: 3000,
    attempts: 2,
    language: 'fr',
  });
  assert.deepEqual(normalizeConfig(null).servers, []);
});

test('servers by slot, with the game, the free type, the name and the secret', () => {
  const config = normalizeConfig({
    server_1_game: 'valheim',
    server_1_address: '192.0.2.10:2457',
    server_1_name: '  Vikings  ',
    server_2_address: '',
    server_3_game: 'other',
    server_3_type: ' Barotrauma ',
    server_3_address: '192.0.2.30',
    server_4_game: 'palworld',
    server_4_address: '192.0.2.40:8212',
    server_4_secret: ' pass word ',
    poll_interval: '300',
    timeout: 10,
    attempts: '3',
    language: 'de',
  });
  assert.deepEqual(config.servers, [
    {
      slot: 1,
      type: 'valheim',
      address: { host: '192.0.2.10', port: 2457 },
      name: 'Vikings',
      secret: null,
    },
    {
      slot: 3,
      type: 'barotrauma',
      address: { host: '192.0.2.30', port: null },
      name: null,
      secret: null,
    },
    {
      slot: 4,
      type: 'palworld',
      address: { host: '192.0.2.40', port: 8212 },
      name: null,
      secret: ' pass word ',
    },
  ]);
  assert.equal(config.pollIntervalMs, 300_000);
  assert.equal(config.timeoutMs, 10_000);
  assert.equal(config.attempts, 3);
  assert.equal(config.language, 'de');
});

test('a wrong address or an unknown type is reported, never guessed', () => {
  const config = normalizeConfig({
    server_1_address: 'not an address',
    server_2_game: 'other',
    server_2_type: 'nope',
    server_2_address: '192.0.2.20',
    server_3_game: 'barotrauma',
    server_3_address: '192.0.2.30',
    server_4_game: '',
    server_4_address: '192.0.2.40',
    poll_interval: '5',
    language: 'it',
  });
  assert.deepEqual(config.invalid, [
    { slot: 1, reason: 'address' },
    { slot: 2, reason: 'game' },
  ]);
  assert.equal(config.servers[0].type, 'barotrauma', 'a GameDig id off the list still works');
  assert.equal(config.servers[1].type, 'valheim', 'empty: the default game');
  assert.equal(config.pollIntervalMs, 60_000);
  assert.equal(config.language, 'fr');
});
