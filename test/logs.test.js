// -----------------------------------------------------------------------------
// What the integration writes at the default level (info): the lifecycle
// only. A normal reading writes nothing — players coming and going included
// —, a failure that repeats is logged once, and its end once. Never a secret.
// (Adapted from guim31/gladys-minecraft.)
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toQueryError } from '../src/query.js';
import { FakeServer, HOST_1, ONE_SERVER, createWorld } from './helpers/world.js';

const SECRET = 'very-secret-palworld-password';

/** Capture the lines of the SDK logger at a level. */
function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  const record =
    (stream) =>
    (...args) =>
      lines.push({
        stream,
        text: args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(' '),
      });
  t.mock.method(console, 'log', record('out'));
  t.mock.method(console, 'error', record('err'));
  return {
    lines,
    clear: () => lines.splice(0),
    texts: () => lines.map((line) => line.text),
  };
}

async function world(t) {
  const server = new FakeServer({ players: ['Ranger'] });
  const w = await createWorld({
    servers: { [HOST_1]: server },
    config: { ...ONE_SERVER, server_1_secret: SECRET },
  });
  t.after(() => w.app.stop());
  for (const device of w.fake.discoveredDevices) {
    await w.fake.deviceCreated(device);
  }
  return { ...w, server };
}

test('a normal reading cycle writes nothing at info, players coming and going included', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  assert.ok(
    logs.texts().some((text) => /Friday arena\): connected \(OpenArena\)/.test(text)),
    logs.texts().join('\n'),
  );
  logs.clear();
  for (const players of [['Ranger', 'Angelyss'], ['Angelyss'], [], ['Major']]) {
    w.server.players = players;
    w.clock.advance(60_000);
    await w.hub.pollAll();
  }
  assert.deepEqual(logs.texts(), []);
});

test('a server that stays down is logged once, and once when it is back', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  logs.clear();
  w.server.online = false;
  for (let i = 0; i < 6; i += 1) {
    w.clock.advance(60_000);
    await w.hub.pollAll();
  }
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.equal(logs.lines[0].stream, 'err');

  logs.clear();
  w.server.online = true;
  await w.hub.pollAll();
  await w.hub.pollAll();
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.match(logs.lines[0].text, /answers again after 5 min/);
  assert.ok(!logs.texts().join('\n').includes(SECRET));
});

test('Gladys refusing the states is logged once', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  logs.clear();
  w.gladys.publishChangedStates = async () => {
    throw new Error('HTTP 429');
  };
  for (const players of [['Angelyss'], ['Major'], ['Ranger']]) {
    w.server.players = players;
    await w.hub.pollAll();
  }
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.match(logs.lines[0].text, /States of .* refused: HTTP 429/);
});

test('LOG_LEVEL=debug shows the joins and each failure; never the secret', async (t) => {
  const logs = captureLogs(t, 'debug');
  const w = await world(t);
  w.server.players = ['Ranger', 'Angelyss'];
  await w.hub.pollAll();
  w.server.online = false;
  await w.hub.pollAll();
  await w.hub.pollAll();
  const text = logs.texts().join('\n');
  assert.match(text, /\[DEBUG\].*Angelyss joined/);
  assert.match(text, /\[DEBUG\].*\(again\)/);
  assert.ok(!text.includes(SECRET), 'never the secret');
});

test('a GameDig failure keeps none of its details: they may hold a token in a URL', () => {
  const err = new Error('Failed all 2 attempts');
  err.stack += `\nAttempt #1 - Port=7777: GET https://192.0.2.10/api?token=${SECRET} ECONNREFUSED`;
  const clean = toQueryError(err, '192.0.2.10');
  assert.equal(clean.message, '192.0.2.10: no answer to the game query');
  assert.ok(!String(clean.stack).includes(SECRET));
  const dns = new Error('Failed all 1 attempts');
  dns.stack += '\nError: getaddrinfo ENOTFOUND game.example.invalid';
  assert.equal(toQueryError(dns, 'game.example.invalid').kind, 'dns');
});
