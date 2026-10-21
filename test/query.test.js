// -----------------------------------------------------------------------------
// What the integration keeps of a GameDig answer (src/query.js readState),
// on the real OpenArena recordings and on answers shaped as the GameDig
// protocols write them; the games of the drop-down list; the address parser.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { games } from 'gamedig';
import { formatAddress, parseAddress } from '../src/address.js';
import { COMMON_GAMES, GAME_VALUES, gameLabel, isKnownType, secretOptions } from '../src/games.js';
import { queryOptions, readState } from '../src/query.js';
import { realAnswer } from './helpers/fakeNetwork.js';

test('the real OpenArena answers: bots are not players, strings become numbers', () => {
  const empty = readState(realAnswer('openarena-0.8.8-empty'));
  assert.deepEqual(empty, {
    name: 'My OA server',
    map: 'oa_dm1',
    version: 'ioq3+oa 1.36+0.8.8_GIT_2d555ac-2016-04-23 linux-x86_64 May 8 2016',
    online: 0,
    max: 16,
    bots: 0,
    players: [],
    namesComplete: true,
    password: false,
    latencyMs: 1,
  });
  const bots = readState(realAnswer('openarena-0.8.8-two-bots'));
  assert.equal(bots.online, 0, 'numplayers 2 counts the two bots');
  assert.equal(bots.bots, 2);
});

test('Valve: numplayers counts the bots, players may have empty names', () => {
  const state = readState({
    name: '  My CS2 server ',
    map: 'de_dust2',
    numplayers: 5,
    maxplayers: 10,
    players: [{ name: '' }, { name: '' }, { name: '' }],
    bots: [{ name: 'BOT Kurt' }, { name: 'BOT Ivan' }],
    version: '1.40.6.3',
    ping: 12.4,
  });
  assert.equal(state.online, 3);
  assert.deepEqual(state.players, []);
  assert.equal(state.namesComplete, false);
  assert.equal(state.name, 'My CS2 server');
  assert.equal(state.latencyMs, 12);
});

test('a count without a list (Mumble), duplicates and control characters', () => {
  const mumble = readState({ numplayers: 4, maxplayers: 50, players: [], bots: [], ping: 3 });
  assert.equal(mumble.online, 4);
  assert.equal(mumble.namesComplete, false);
  assert.equal(mumble.map, '');
  const twice = readState({ numplayers: 2, players: [{ name: 'Ann' }, { name: 'Ann' }] });
  assert.deepEqual(twice.players, ['Ann']);
  assert.equal(twice.namesComplete, false, 'two players, one name: names are not enough');
  const odd = readState({ numplayers: 1, players: [{ name: 'Ann\u0000\n' }], name: 7 });
  assert.deepEqual(odd.players, ['Ann']);
  assert.equal(odd.name, '7');
  assert.deepEqual(readState(undefined).players, []);
});

test('every game of the list is a GameDig game, with its own name', () => {
  for (const [value, label] of COMMON_GAMES) {
    assert.ok(Object.hasOwn(games, value), `${value} is a GameDig id`);
    assert.equal(gameLabel(value), label);
  }
  assert.equal(new Set(GAME_VALUES).size, GAME_VALUES.length);
  assert.equal(GAME_VALUES.at(-1), 'other');
  assert.ok(isKnownType('barotrauma') && isKnownType('protocol-valve'));
  assert.ok(!isKnownType('protocol-nope') && !isKnownType('nope') && !isKnownType(''));
  assert.ok(!isKnownType('constructor') && !isKnownType('__proto__'));
  assert.equal(gameLabel('barotrauma'), 'Barotrauma');
  assert.equal(gameLabel('protocol-valve'), 'valve');
});

test('the secret goes to the option each protocol reads, and nowhere else', () => {
  assert.deepEqual(secretOptions('palworld', 's'), { username: 'admin', password: 's' });
  assert.deepEqual(secretOptions('terrariatshock', 's'), { token: 's' });
  assert.deepEqual(secretOptions('satisfactory', 's'), { token: 's' });
  assert.deepEqual(secretOptions('farmingsimulator25', 's'), { token: 's' });
  assert.deepEqual(secretOptions('valheim', 's'), {});
  assert.deepEqual(secretOptions('palworld', null), {});
});

test('addresses as typed in a server browser', () => {
  assert.deepEqual(parseAddress(' 192.0.2.10 '), { host: '192.0.2.10', port: null });
  assert.deepEqual(parseAddress('Game.Example.com:2457'), { host: 'game.example.com', port: 2457 });
  assert.deepEqual(parseAddress('steam://connect/192.0.2.10:27015'), {
    host: '192.0.2.10',
    port: 27015,
  });
  assert.deepEqual(parseAddress('[2001:db8::1]:27015'), { host: '2001:db8::1', port: 27015 });
  for (const bad of ['', 'a b', 'host:0', 'host:70000', 'user@host', 'http://host/path', 42]) {
    assert.equal(parseAddress(bad), null, String(bad));
  }
  assert.equal(formatAddress({ host: '2001:db8::1', port: 27015 }), '[2001:db8::1]:27015');
});

test('the GameDig options: no shared port cache, the typed port alone when no other is tried', () => {
  const base = { secret: null };
  const at = (type, port) =>
    queryOptions(
      { ...base, type, address: { host: '192.0.2.10', port } },
      {
        timeoutMs: 3000,
        attempts: 2,
      },
    );
  const valheim = at('valheim', 2456);
  assert.equal(valheim.portCache, false);
  assert.equal(valheim.givenPortOnly, undefined, 'Valheim: game port + 1 is tried too');
  assert.equal(at('conanexiles', 7777).givenPortOnly, undefined, 'its fixed query port too');
  assert.equal(at('counterstrike2', 27016).givenPortOnly, true);
  assert.equal(at('counterstrike2', null).port, undefined, 'no port: the default of the game');
  assert.deepEqual(
    [valheim.maxRetries, valheim.socketTimeout, valheim.attemptTimeout],
    [2, 3000, 12000],
  );
});

test('Valve without a player list: the bots come from numbots', () => {
  const cs2 = readState({
    numplayers: 8,
    maxplayers: 10,
    players: [],
    bots: [],
    raw: { numbots: 6 },
  });
  assert.equal(cs2.online, 2);
  assert.equal(cs2.bots, 6);
});
