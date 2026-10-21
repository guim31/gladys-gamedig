// -----------------------------------------------------------------------------
// The hub against fake servers: states, scene events on transitions, the
// optional features, the outage, the scene action and the report.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRIGGERS, WIDGET_KEY } from '../src/hub.js';
import {
  FakeServer,
  HOST_1,
  HOST_3,
  ONE_SERVER,
  createAll,
  createWorld,
  deviceId,
  events,
  featureId,
} from './helpers/world.js';

async function world(t, { server = new FakeServer(), config = ONE_SERVER, create = true } = {}) {
  const w = await createWorld({ servers: { [HOST_1]: server }, config });
  t.after(() => w.app.stop());
  if (create) {
    await createAll(w);
  }
  return { ...w, server };
}

const state = (w, key) => w.fake.lastState(featureId(w.gladys, key));

test('one device per server, read before it is published, with the real OpenArena values', async (t) => {
  const w = await world(t, { server: new FakeServer({ players: ['Ranger'], bots: ['Sarge'] }) });
  const [device] = w.fake.discoveredDevices;
  assert.equal(device.name, 'Friday arena');
  assert.equal(device.external_id, deviceId(w.gladys));
  assert.equal(device.should_poll, false);
  assert.deepEqual(
    device.features.map((feature) => feature.external_id.split(':').pop()),
    [
      'online',
      'players_online',
      'players_max',
      'players',
      'map',
      'server_name',
      'version',
      'latency',
    ],
  );
  assert.equal(state(w, 'online'), 1);
  assert.equal(state(w, 'players_online'), 1, 'the bot is not a player');
  assert.equal(state(w, 'players_max'), 16);
  assert.equal(state(w, 'players'), 'Ranger');
  assert.equal(state(w, 'map'), 'oa_dm1');
  assert.equal(state(w, 'server_name'), 'My OA server');
  assert.match(state(w, 'version'), /^ioq3\+oa 1\.36/);
  assert.equal(state(w, 'latency'), 4);
  assert.deepEqual(w.fake.transports.at(-1), {
    device_external_id: deviceId(w.gladys),
    transport: 'cloud',
  });
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('a server on the local network has the local transport; the default name says game and address', async (t) => {
  const network = await createWorld({
    servers: { '192.168.1.20:2457': new FakeServer() },
    config: { server_1_game: 'valheim', server_1_address: '192.168.1.20:2457' },
  });
  t.after(() => network.app.stop());
  await createAll(network);
  assert.equal(network.fake.discoveredDevices[0].name, 'Valheim 192.168.1.20:2457');
  assert.equal(network.fake.transports.at(-1).transport, 'local');
});

test('the optional features only appear once the game gives them', async (t) => {
  const server = new FakeServer();
  server.answer.map = '';
  server.answer.version = '';
  const w = await world(t, { server });
  const keys = () =>
    w.fake.discoveredDevices[0].features.map((feature) => feature.external_id.split(':').pop());
  assert.ok(!keys().includes('map') && !keys().includes('version'));
  assert.ok(keys().includes('server_name'));
  server.answer.map = 'oa_dm4';
  await w.hub.pollAll();
  assert.ok(keys().includes('map'), 'published again with the map');
  assert.ok(!keys().includes('version'));
});

test('players joining and leaving, by name, with the minutes played', async (t) => {
  const w = await world(t, { server: new FakeServer({ players: ['Ranger'] }) });
  assert.deepEqual(events(w, TRIGGERS.PLAYER_JOINED), [], 'the first reading is a starting point');
  w.server.players = ['Ranger', 'Angelyss'];
  await w.hub.pollAll();
  w.clock.advance(25 * 60_000);
  w.server.players = ['Ranger'];
  await w.hub.pollAll();
  assert.deepEqual(events(w, TRIGGERS.PLAYER_JOINED), [
    {
      device: deviceId(w.gladys),
      server: 'Friday arena',
      game: 'OpenArena',
      players_online: 2,
      players_max: 16,
      player: 'Angelyss',
    },
  ]);
  assert.deepEqual(events(w, TRIGGERS.PLAYER_LEFT), [
    {
      device: deviceId(w.gladys),
      server: 'Friday arena',
      game: 'OpenArena',
      players_online: 1,
      players_max: 16,
      player: 'Angelyss',
      minutes_played: 25,
    },
  ]);
  assert.equal(state(w, 'players'), 'Ranger');
});

test('a game without names: joins and leaves by count, with an empty name', async (t) => {
  const w = await world(t, { server: new FakeServer({ players: ['a'], names: false }) });
  assert.equal(state(w, 'players'), '1 player(s), names not given by the game');
  w.server.players = ['a', 'b', 'c'];
  await w.hub.pollAll();
  assert.deepEqual(
    events(w, TRIGGERS.PLAYER_JOINED).map((event) => event.player),
    ['', ''],
  );
  w.server.players = ['a'];
  await w.hub.pollAll();
  assert.deepEqual(
    events(w, TRIGGERS.PLAYER_LEFT).map((event) => [event.player, event.minutes_played]),
    [
      ['', null],
      ['', null],
    ],
  );
});

test('bots never count: a bot joining fires nothing', async (t) => {
  const w = await world(t, { server: new FakeServer({ players: ['Ranger'] }) });
  w.server.bots = ['Sarge', 'Grism'];
  await w.hub.pollAll();
  assert.equal(state(w, 'players_online'), 1);
  assert.deepEqual(w.fake.sceneEvents, []);
});

test('the server empties, then fills up: one event each, not one per reading', async (t) => {
  const w = await world(t, { server: new FakeServer({ players: ['Ranger'], max: 2 }) });
  w.server.players = [];
  await w.hub.pollAll();
  await w.hub.pollAll();
  assert.equal(events(w, TRIGGERS.SERVER_EMPTY).length, 1);
  assert.equal(events(w, TRIGGERS.SERVER_EMPTY)[0].players_max, 2);
  w.server.players = ['Ranger', 'Angelyss'];
  await w.hub.pollAll();
  await w.hub.pollAll();
  assert.deepEqual(events(w, TRIGGERS.SERVER_FULL), [
    {
      device: deviceId(w.gladys),
      server: 'Friday arena',
      game: 'OpenArena',
      players_online: 2,
      players_max: 2,
    },
  ]);
});

test('an outage: offline after two failures, back with its duration, no join on return', async (t) => {
  const w = await world(t, { server: new FakeServer({ players: ['Ranger'] }) });
  w.server.online = false;
  await w.hub.pollAll();
  assert.equal(state(w, 'online'), 1, 'one lost answer is not an outage');
  assert.deepEqual(events(w, TRIGGERS.SERVER_OFFLINE), []);
  w.clock.advance(15_000);
  await w.hub.pollAll();
  assert.equal(state(w, 'online'), 0);
  assert.equal(state(w, 'players_online'), 0);
  assert.equal(state(w, 'players'), 'Server offline');
  assert.equal(state(w, 'map'), 'oa_dm1', 'the map keeps its last value');
  assert.equal(events(w, TRIGGERS.SERVER_OFFLINE).length, 1);
  assert.match(events(w, TRIGGERS.SERVER_OFFLINE)[0].error, /does not answer/);
  assert.deepEqual(events(w, TRIGGERS.PLAYER_LEFT), [], 'no leave for an outage');
  assert.deepEqual(events(w, TRIGGERS.SERVER_EMPTY), []);
  assert.equal(w.fake.transports.at(-1).transport, 'unreachable');
  assert.equal(w.fake.connectionStatus.connected, false);

  w.clock.advance(10 * 60_000);
  w.server.online = true;
  w.server.players = ['Ranger', 'Angelyss'];
  await w.hub.pollAll();
  assert.deepEqual(events(w, TRIGGERS.SERVER_ONLINE), [
    {
      device: deviceId(w.gladys),
      server: 'Friday arena',
      game: 'OpenArena',
      minutes_offline: 10,
      players_online: 2,
      players_max: 16,
    },
  ]);
  assert.deepEqual(events(w, TRIGGERS.PLAYER_JOINED), [], 'the return is a starting point');
  assert.equal(state(w, 'online'), 1);
  assert.equal(w.fake.transports.at(-1).transport, 'cloud');
});

test('a server restarting full fires at most ten joins', async (t) => {
  const w = await world(t, { server: new FakeServer({ names: false }) });
  w.server.players = Array.from({ length: 30 }, (_, i) => `p${i}`);
  await w.hub.pollAll();
  assert.equal(events(w, TRIGGERS.PLAYER_JOINED).length, 10);
});

test('the events fire before the device is added; the states wait for it', async (t) => {
  const w = await world(t, { server: new FakeServer({ players: [] }), create: false });
  w.server.players = ['Ranger'];
  await w.hub.pollAll();
  assert.equal(events(w, TRIGGERS.PLAYER_JOINED).length, 1);
  assert.deepEqual(w.fake.states, []);
  await createAll(w);
  assert.equal(state(w, 'players'), 'Ranger', 'everything is sent when the device is added');
  assert.ok(w.fake.widgetRefreshes.includes(WIDGET_KEY));
});

test('the reading options of the configuration reach the query', async (t) => {
  const w = await world(t, { config: { ...ONE_SERVER, timeout: '5', attempts: '3' } });
  assert.deepEqual(w.server.lastOptions, { timeoutMs: 5000, attempts: 3 });
});

test('the scene action reads the server now and returns its state', async (t) => {
  const w = await world(t, { server: new FakeServer({ players: ['Ranger', 'Angelyss'] }) });
  const before = w.server.queries;
  const ack = await w.fake.sceneAction('read_server', { device: deviceId(w.gladys) });
  assert.equal(ack.success, true, ack.error);
  assert.equal(w.server.queries, before + 1);
  assert.deepEqual(ack.data.outputs, {
    online: true,
    players_online: 2,
    players_max: 16,
    players: 'Ranger, Angelyss',
    map: 'oa_dm1',
    server_name: 'My OA server',
    version: 'ioq3+oa 1.36+0.8.8_GIT_2d555ac-2016-04-23 linux-x86_64 May 8 2016',
    latency: 4,
    server: 'Friday arena',
    game: 'OpenArena',
  });
  w.server.online = false;
  await w.hub.pollAll();
  const down = await w.fake.sceneAction('read_server', { device: deviceId(w.gladys) });
  assert.equal(down.data.outputs.online, false);
  assert.equal(down.data.outputs.players_online, 0);
  const unknown = await w.fake.sceneAction('read_server', { device: 'gamedig:server:9' });
  assert.equal(unknown.success, false);
  assert.match(unknown.error, /no longer in the configuration/);
});

test('"Test the connection" reports each server, and the slots it cannot read', async (t) => {
  const w = await createWorld({
    servers: { [HOST_1]: new FakeServer({ players: ['Ranger'] }) },
    config: {
      ...ONE_SERVER,
      server_2_address: HOST_3,
      server_3_address: 'not a valid address',
      server_4_game: 'other',
      server_4_type: 'not-a-game',
      server_4_address: HOST_3,
    },
  });
  t.after(() => w.app.stop());
  const ack = await w.fake.action('test_connection');
  assert.equal(ack.success, true, ack.error);
  assert.equal(
    ack.data.message.en,
    [
      'Friday arena: OpenArena, 1/16 players, 4 ms, map oa_dm1',
      `Valheim ${HOST_3}: does not answer (game, port, query enabled?)`,
      '#3: address not understood, e.g. 192.168.1.20 or game.example.com:2457',
      '#4: unknown GameDig type, see its games list',
    ].join('\n'),
  );
  assert.match(ack.data.message.fr, /^Friday arena : OpenArena, 1\/16 joueurs/);
  assert.equal(w.fake.connectionStatus.connected, true, 'one server answers');
});

test('no server configured: the connection status says what to do', async (t) => {
  const w = await createWorld({ config: {} });
  t.after(() => w.app.stop());
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.en, /Choose the game and enter the address/);
  assert.deepEqual(w.fake.discoveredDevices, []);
});

test('a new configuration keeps the device of a renamed server and drops a removed one', async (t) => {
  const w = await world(t, { server: new FakeServer({ players: ['Ranger'] }) });
  await w.fake.configUpdated({ ...ONE_SERVER, server_1_name: 'Saturday arena', language: 'fr' });
  const [device] = w.fake.discoveredDevices;
  assert.equal(device.name, 'Saturday arena');
  assert.equal(device.external_id, deviceId(w.gladys));
  assert.equal(state(w, 'players'), 'Ranger');
  w.server.players = [];
  await w.hub.pollAll();
  assert.equal(state(w, 'players'), 'Personne', 'worded in the new language');
  await w.fake.configUpdated({ language: 'fr' });
  assert.deepEqual(w.fake.discoveredDevices, []);
});
