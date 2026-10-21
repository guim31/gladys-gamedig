// -----------------------------------------------------------------------------
// Optional: the whole integration against a real game server, through the
// real GameDig, with the SDK's fake Gladys. Skipped unless GAMEDIG_REAL_HOST
// is set (the normal test suite never touches the network).
//
//   GAMEDIG_REAL_HOST=192.0.2.10 [GAMEDIG_REAL_TYPE=openarena] \
//   [GAMEDIG_REAL_RCON=password] npm run test:real
//
// Written for an OpenArena (Quake 3) server: with its RCON password, the test
// adds two bots and checks they are not counted as players, then kicks them.
// Also reads a closed port and a name that does not exist.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';

const HOST = process.env.GAMEDIG_REAL_HOST;
const TYPE = process.env.GAMEDIG_REAL_TYPE ?? 'openarena';
const RCON = process.env.GAMEDIG_REAL_RCON;
process.env.LOG_LEVEL ??= 'silent';

/** A Quake 3 RCON command (one UDP packet). */
function rcon(command) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket(HOST.includes(':') ? 'udp6' : 'udp4');
    const packet = Buffer.concat([
      Buffer.from([0xff, 0xff, 0xff, 0xff]),
      Buffer.from(`rcon ${RCON} ${command}`, 'latin1'),
    ]);
    socket.send(packet, 27960, HOST, () => setTimeout(() => socket.close(resolve), 1500));
  });
}

test('a real server, a closed port and an unknown name', { skip: !HOST }, async (t) => {
  const gladys = createFakeGladys({
    config: {
      server_1_game: TYPE,
      server_1_address: HOST,
      server_1_name: 'Real',
      server_2_game: TYPE,
      server_2_address: `${HOST.includes(':') ? `[${HOST}]` : HOST}:27999`,
      server_3_game: TYPE,
      server_3_address: 'gladys-test-gamedig.invalid',
      timeout: '2',
      attempts: '1',
      language: 'en',
    },
  });
  const app = registerHandlers(gladys, { timers: false });
  t.after(() => app.stop());
  await gladys.connect();
  await app.ready;
  const { fake } = gladys;
  for (const device of fake.discoveredDevices) {
    await fake.deviceCreated(device);
  }
  const real = fake.discoveredDevices.find((device) => device.name === 'Real');
  assert.ok(real.features.some((feature) => feature.external_id.endsWith(':map')));
  const value = (key, slot = 1) =>
    fake.lastState(gladys.externalIds('server', String(slot)).feature(key));
  assert.equal(value('online'), 1);
  assert.ok(value('players_max') > 0);
  assert.ok(value('latency') >= 0);
  console.log(`real: ${value('players')} on ${value('map')}, ${value('latency')} ms`);

  const report = await fake.action('test_connection');
  console.log(report.data.message.en);
  assert.match(report.data.message.en, /^Real: /);
  assert.match(report.data.message.en, /does not answer/);
  assert.match(report.data.message.en, /name not found/);

  if (RCON) {
    const before = value('players_online');
    await rcon('addbot Sarge 1');
    await rcon('addbot Grism 1');
    await app.hub.pollAll();
    assert.equal(value('players_online'), before, 'bots are not players');
    assert.equal(app.hub.records.get(1).status.bots, 2);
    await rcon('kick allbots');
  }
  // Two failed readings: the closed port and the unknown name are offline.
  await app.hub.pollAll();
  assert.equal(value('online', 2), 0);
  assert.equal(value('online', 3), 0);
  assert.equal(fake.sceneEvents.filter((event) => event.key === 'server_offline').length, 2);
});
