// -----------------------------------------------------------------------------
// The `game_servers` dashboard widget: content within the core vocabulary and
// budget (checked with the SDK's validator), one server or all four, online,
// offline, a game without names, in the language Gladys asks for.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from '../src/hub.js';
import {
  FakeServer,
  HOST_1,
  HOST_2,
  HOST_3,
  HOST_4,
  ONE_SERVER,
  createWorld,
  deviceId,
} from './helpers/world.js';

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

async function content(w, settings = {}, language = 'en') {
  const ack = await w.fake.widgetGet(WIDGET_KEY, { settings, language });
  assert.equal(ack.success, true, ack.error);
  const { content: tree } = ack.data;
  assert.deepEqual(validateWidgetContent(tree), [], 'within the core vocabulary and budget');
  assert.ok(tree.components.length <= 8);
  return tree;
}

const ofType = (tree, type) => tree.components.filter((component) => component.type === type);
const rows = (tree) => ofType(tree, 'status')[0].items.map(({ label, value }) => [label, value]);

test('one server: players and ping tiles, state with the map, who is playing', async (t) => {
  const w = await world(t, {
    servers: { [HOST_1]: new FakeServer({ players: ['Ranger', 'Angelyss'] }) },
  });
  const tree = await content(w);
  assert.deepEqual(
    ofType(tree, 'value').map(({ label, value, unit, color }) => [label, value, unit, color]),
    [
      ['Players', '2/16', undefined, 'success'],
      ['Ping', 4, 'ms', undefined],
    ],
  );
  assert.deepEqual(rows(tree), [
    ['Friday arena', 'Online · oa_dm1'],
    ['Players', 'Ranger, Angelyss'],
  ]);
  const french = await content(w, {}, 'fr');
  assert.deepEqual(rows(french)[0], ['Friday arena', 'En ligne · oa_dm1']);
});

test('four servers: one tile each, a game without names, an offline one', async (t) => {
  const offline = new FakeServer();
  offline.online = false;
  const w = await world(t, {
    servers: {
      [HOST_1]: new FakeServer({ players: [] }),
      [HOST_2]: new FakeServer({ players: ['a', 'b'], names: false }),
      [HOST_3]: offline,
      [HOST_4]: new FakeServer({ players: Array.from({ length: 16 }, (_, i) => `Player${i}`) }),
    },
    config: {
      ...ONE_SERVER,
      server_2_game: 'counterstrike2',
      server_2_address: HOST_2,
      server_2_name: 'CS2',
      server_3_address: HOST_3,
      server_3_name: 'Old box',
      server_4_address: HOST_4,
      server_4_name: 'Full',
    },
  });
  await w.hub.pollAll(); // the second failure: offline
  const tree = await content(w);
  assert.deepEqual(
    ofType(tree, 'value').map(({ label, value, color }) => [label, value, color]),
    [
      ['Friday arena', '0/16', 'success'],
      ['CS2', '2/16', 'success'],
      ['Old box', 'Offline', 'danger'],
      ['Full', '16/16', 'success'],
    ],
  );
  const status = rows(tree);
  assert.ok(status.length <= 10);
  assert.deepEqual(status.slice(0, 5), [
    ['Friday arena', 'Online · oa_dm1'],
    ['Players · Friday arena', 'Nobody'],
    ['CS2', 'Online · oa_dm1'],
    ['Players · CS2', '2 · names not given'],
    ['Old box', 'Offline'],
  ]);
  assert.ok(status.at(-1)[1].endsWith('…'), 'a long list is cut to 40 characters');
});

test('one server chosen in the settings; a server removed from the configuration', async (t) => {
  const w = await world(t, {
    servers: { [HOST_1]: new FakeServer(), [HOST_2]: new FakeServer() },
    config: { ...ONE_SERVER, server_2_address: HOST_2, server_2_name: 'Second' },
  });
  const tree = await content(w, { device: deviceId(w.gladys, 2) });
  assert.deepEqual(rows(tree)[0], ['Second', 'Online · oa_dm1']);
  const gone = await content(w, { device: deviceId(w.gladys, 4) });
  assert.match(gone.components[0].text, /no longer in the configuration/);
});

test('no server configured: the widget says what to do', async (t) => {
  const w = await world(t, { config: {} });
  const tree = await content(w, {}, 'de');
  assert.match(tree.components[0].text, /^Wähle das Spiel/);
});
