// -----------------------------------------------------------------------------
// The game server hub: one record per configured server, read on a timer of
// the container (the interval chosen in the configuration), its states
// published to Gladys when they change (and every few hours, the heartbeat),
// its scene events fired on transitions (a player joined or left, the server
// went offline or came back, emptied or filled up), and the reading of the
// scene action.
//
// Gladys never polls these devices (should_poll: false): Gladys 5.2 does not
// poll an external device reliably (GladysAssistant/Gladys#3198), and the
// scene events must fire even for a server whose device was not added. Every
// configured server is read; the states only go to the devices added to
// Gladys (it drops the others and they count in its 300 states a minute).
// (Structure from guim31/gladys-minecraft.)
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS, createLogger } from '@gladysassistant/integration-sdk';
import { isIP } from 'node:net';
import {
  OPTIONAL_KEYS,
  buildDevice,
  deviceIds,
  featureStates,
  playersText,
  serverName,
  slotOf,
} from './devices.js';
import { gameLabel } from './games.js';
import { QueryError, queryServer } from './query.js';
import {
  ACTION_TEXT,
  CONNECTION_TEXT,
  ERROR_TEXT,
  INVALID_TEXT,
  REPORT_TEXT,
  labelled,
  pick,
} from './texts.js';

const logger = createLogger({ name: 'gamedig-hub' });

export const WIDGET_KEY = 'game_servers';

// Scene trigger keys (manifest `scene_triggers`): permanent once published.
export const TRIGGERS = Object.freeze({
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  SERVER_OFFLINE: 'server_offline',
  SERVER_ONLINE: 'server_online',
  SERVER_EMPTY: 'server_empty',
  SERVER_FULL: 'server_full',
});

export const HUB_TIMINGS = {
  // A server that fails once is read again this soon, to tell a blip from an outage.
  retryMs: 15_000,
  // Failures in a row before a server counts as offline (state and scene event).
  downAfterFailures: 2,
  // An unchanged value is sent again this often, so Gladys never shows it as
  // stale ("no recent value" after 48 h).
  heartbeatMs: 6 * 60 * 60_000,
};

// Joins or leaves fired for one reading at most: a server restarting with
// 64 players in it must not flood the scenes (300 events a minute).
export const MAX_EVENTS_PER_READING = 10;

/** The real network: GameDig. Tests pass a fake one. */
export const NETWORK = {
  query: (server, options) => queryServer(server, options),
};

const signature = (server) => JSON.stringify([server.type, server.address, server.secret]);

// Servers on the Internet, for the transport badge of the device.
const isLocalHost = (host) =>
  host === 'localhost' ||
  host.endsWith('.local') ||
  host.endsWith('.lan') ||
  host.endsWith('.home.arpa') ||
  (isIP(host) === 4 &&
    /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/u.test(host)) ||
  (isIP(host) === 6 && /^(::1$|fe80:|f[cd])/iu.test(host)) ||
  (isIP(host) === 0 && !host.includes('.'));

export class GameServerHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {object} [options.network] NETWORK seam (tests)
   * @param {boolean} [options.timers] periodic timers (off in tests)
   * @param {object} [options.timings] HUB_TIMINGS overrides
   * @param {() => number} [options.now]
   */
  constructor({ gladys, network = NETWORK, timers = true, timings, now }) {
    this.gladys = gladys;
    this.network = network;
    this.timersEnabled = timers;
    this.timings = { ...HUB_TIMINGS, ...timings };
    this.now = now ?? (() => Date.now());
    this.config = null;
    /** @type {Map<number, object>} server records, by slot */
    this.records = new Map();
    this.transports = new Map();
    this.connection = null;
    this.pollTimer = null;
    this.stopped = false;
    /** Problems already logged, by key: repeats go to debug. */
    this.warned = new Set();
  }

  // --- Logs ------------------------------------------------------------------
  // Info keeps the lifecycle only (servers connected, lost, back). A problem
  // that repeats every cycle is logged once, then at debug until it clears.
  // LOG_LEVEL=debug shows everything.

  /** Log a problem once (`level` warn or error), its repeats at debug. */
  problem(key, message, err, level = 'warn') {
    const args = err === undefined ? [message] : [message, err];
    if (this.warned.has(key)) {
      logger.debug(...args);
      return;
    }
    this.warned.add(key);
    logger[level](...args);
  }

  /** The problem `key` is gone: the next occurrence is logged again. */
  resolved(key) {
    this.warned.delete(key);
  }

  label(record) {
    return `Server ${record.server.slot} (${serverName(record.server)})`;
  }

  get language() {
    return this.config?.language ?? 'fr';
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    await this.reconfigure(config);
  }

  /** Gladys reconnected (it restarted): send everything again. */
  async resync(config) {
    this.gladys.forgetPublishedStates();
    this.transports.clear();
    this.connection = null;
    await this.reconfigure(config);
  }

  async reconfigure(config) {
    const languageChanged = this.config !== null && this.config.language !== config.language;
    this.config = config;
    const wanted = new Map(config.servers.map((server) => [server.slot, server]));
    for (const [slot, record] of this.records) {
      const server = wanted.get(slot);
      if (!server || record.signature !== signature(server)) {
        this.dropRecord(record);
        this.records.delete(slot);
      }
    }
    for (const server of config.servers) {
      const record = this.records.get(server.slot);
      if (record) {
        record.server = server; // a new name: same server, same players
      } else {
        this.records.set(server.slot, this.newRecord(server));
      }
    }
    if (languageChanged) {
      // The players text is worded in the configured language.
      this.gladys.forgetPublishedStates();
    }
    // Read first: the devices then carry the optional features the games give.
    // The timer starts whatever happens: a refused discovery must not stop
    // the readings, the scene events and the widget.
    try {
      await this.pollAll({ publish: false });
      await this.publishDevices();
    } finally {
      this.schedulePoll();
    }
  }

  newRecord(server) {
    return {
      server,
      signature: signature(server),
      status: null,
      reachable: null,
      error: null,
      failures: 0,
      down: false,
      downSince: null,
      /** The optional features (map, name, version) the server has given. */
      seen: new Set(),
      /** Players online at the last reading, null: no starting point. */
      lastOnline: null,
      /** The last complete list of names (a Set), null when unknown. */
      names: null,
      /** When each player was seen joining. */
      joinedAt: new Map(),
      polling: null,
      retryTimer: null,
      dropped: false,
    };
  }

  dropRecord(record) {
    record.dropped = true;
    clearTimeout(record.retryTimer);
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.pollTimer);
    for (const record of this.records.values()) {
      this.dropRecord(record);
    }
  }

  schedulePoll() {
    clearTimeout(this.pollTimer);
    if (!this.timersEnabled || this.stopped || this.records.size === 0) {
      return;
    }
    this.pollTimer = setTimeout(async () => {
      try {
        await this.pollAll();
        this.resolved('poll');
      } catch (err) {
        this.problem('poll', 'Reading cycle failed', err, 'error');
      }
      this.schedulePoll();
    }, this.config.pollIntervalMs);
  }

  // --- Devices -----------------------------------------------------------------

  async publishDevices() {
    const devices = [...this.records.values()].map((record) =>
      buildDevice(this.gladys, record.server, record.seen, this.language),
    );
    // Even an empty list: the Discovery tab then shows no stale server.
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.resolved('discovery');
    } catch (err) {
      this.problem('discovery', `Devices refused by Gladys: ${err.message}`);
    }
  }

  /** "Search" in the Discovery tab: read the servers, publish the devices again. */
  async rediscover() {
    await this.pollAll({ publish: false });
    await this.publishDevices();
  }

  /** The device external ids the user added to Gladys. */
  createdDevices() {
    return new Set((this.gladys.devices ?? []).map((device) => device.external_id));
  }

  recordOf(externalId) {
    const slot = slotOf(this.gladys, externalId);
    return slot === null ? null : (this.records.get(slot) ?? null);
  }

  /** The user added (or updated) a device: the SDK forgot its states, send them again now. */
  async onDeviceCreated(device) {
    const record = this.recordOf(device.external_id);
    if (!record) {
      return;
    }
    await this.publishStates(record, { created: true });
    this.transports.delete(device.external_id);
    await this.publishTransports();
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  // --- Reading the servers -------------------------------------------------------

  /**
   * Read every server. `publish: false` leaves the devices to the caller
   * (reconfigure publishes them right after).
   */
  async pollAll({ publish = true } = {}) {
    const records = [...this.records.values()];
    const results = await Promise.all(records.map((record) => this.poll(record)));
    if (publish && results.some((result) => result.newFeatures)) {
      await this.publishDevices();
    }
    await this.afterChanges(results.some((result) => result.widget));
  }

  /** Gladys asks for a refresh (onPoll, a fallback): read that server now. */
  async pollDevice(device) {
    const record = this.recordOf(device.external_id);
    if (record) {
      await this.pollOne(record);
    }
  }

  async pollOne(record) {
    const result = await this.poll(record);
    if (result.newFeatures) {
      await this.publishDevices();
    }
    await this.afterChanges(result.widget);
  }

  /**
   * Read one server and apply what changed. Concurrent calls share the read.
   * @returns {Promise<{ widget: boolean, newFeatures: boolean }>}
   */
  poll(record) {
    record.polling ??= this.read(record).finally(() => {
      record.polling = null;
    });
    return record.polling;
  }

  async read(record) {
    let status;
    try {
      status = await this.network.query(record.server, {
        timeoutMs: this.config.timeoutMs,
        attempts: this.config.attempts,
      });
    } catch (err) {
      if (!(err instanceof QueryError)) {
        throw err;
      }
      return { widget: await this.applyFailure(record, err), newFeatures: false };
    }
    return this.applySuccess(record, status);
  }

  async applySuccess(record, status) {
    if (record.dropped) {
      return { widget: false, newFeatures: false };
    }
    const previous = record.status;
    const wasDown = record.down;
    if (wasDown) {
      const downMinutes = Math.round((this.now() - record.downSince) / 60_000);
      logger.info(`${this.label(record)} answers again after ${downMinutes} min`);
    } else if (record.error) {
      logger.info(`${this.label(record)}: answers again`);
    } else if (record.reachable === null) {
      logger.info(`${this.label(record)}: connected (${gameLabel(record.server.type)})`);
    }
    const widget =
      record.reachable !== true ||
      record.error !== null ||
      previous?.online !== status.online ||
      previous?.max !== status.max ||
      previous?.map !== status.map ||
      (previous?.players ?? []).join() !== status.players.join();
    let newFeatures = false;
    for (const key of OPTIONAL_KEYS) {
      const value = { map: status.map, server_name: status.name, version: status.version }[key];
      if (value && !record.seen.has(key)) {
        record.seen.add(key);
        newFeatures = true;
      }
    }
    const downSince = record.downSince;
    record.failures = 0;
    record.down = false;
    record.downSince = null;
    record.error = null;
    record.reachable = true;
    record.status = status;
    if (wasDown) {
      await this.fire(TRIGGERS.SERVER_ONLINE, record, {
        minutes_offline: Math.round((this.now() - downSince) / 60_000),
        players_online: status.online,
        players_max: status.max,
      });
    }
    await this.playerTransitions(record, status);
    await this.publishStates(record);
    return { widget, newFeatures };
  }

  async applyFailure(record, err) {
    if (record.dropped) {
      return false;
    }
    const wasError = record.error?.kind;
    record.error = { kind: err.kind, message: err.message };
    record.reachable = false;
    // One warning when the problem starts (or changes), not one per reading.
    if (wasError !== err.kind) {
      logger.warn(`${this.label(record)}: ${err.message}`);
    } else {
      logger.debug(`${this.label(record)}: ${err.message} (again)`);
    }
    record.failures += 1;
    if (record.failures === 1) {
      record.downSince = this.now();
      this.scheduleRetry(record);
    }
    let changed = wasError !== err.kind;
    if (!record.down && record.failures >= this.timings.downAfterFailures) {
      record.down = true;
      changed = true;
      // Who was playing is unknown from now on: no "left" event for each of
      // them, the next reading is a new starting point.
      record.lastOnline = null;
      record.names = null;
      record.joinedAt.clear();
      // Only a server seen answering goes offline: one already down when the
      // integration starts (Gladys restarted, a new address) fires nothing.
      if (record.status !== null) {
        await this.fire(TRIGGERS.SERVER_OFFLINE, record, {
          error: pick(ERROR_TEXT[err.kind], this.language),
        });
      }
    }
    if (record.down) {
      // Every reading, for the heartbeat of a long outage (only changes are sent).
      await this.publishStates(record);
    }
    return changed;
  }

  scheduleRetry(record) {
    clearTimeout(record.retryTimer);
    if (!this.timersEnabled || this.stopped) {
      return;
    }
    record.retryTimer = setTimeout(() => {
      this.pollOne(record)
        .then(() => this.resolved('retry'))
        .catch((err) => this.problem('retry', 'Retry failed', err, 'error'));
    }, this.timings.retryMs);
    record.retryTimer.unref?.();
  }

  /**
   * Joins and leaves, emptied and full, between two readings of an
   * answering server. By name when both readings name every player, else
   * by count (the event then has no player name). The first reading, and
   * the first after an outage, are a starting point: no event.
   */
  async playerTransitions(record, status) {
    const beforeOnline = record.lastOnline;
    const beforeNames = record.names;
    record.lastOnline = status.online;
    record.names = status.namesComplete ? new Set(status.players) : null;
    const now = this.now();
    if (!status.namesComplete) {
      record.joinedAt.clear();
    }
    if (beforeOnline === null) {
      if (status.namesComplete) {
        for (const name of [...record.joinedAt.keys()]) {
          if (!record.names.has(name)) {
            record.joinedAt.delete(name);
          }
        }
      }
      return;
    }
    const base = { players_online: status.online, players_max: status.max };
    if (beforeNames && status.namesComplete) {
      const joined = status.players.filter((name) => !beforeNames.has(name));
      const left = [...beforeNames].filter((name) => !record.names.has(name));
      for (const name of joined.slice(0, MAX_EVENTS_PER_READING)) {
        record.joinedAt.set(name, now);
        logger.debug(`${this.label(record)}: ${name} joined`);
        await this.fire(TRIGGERS.PLAYER_JOINED, record, { ...base, player: name });
      }
      for (const name of left.slice(0, MAX_EVENTS_PER_READING)) {
        const since = record.joinedAt.get(name);
        record.joinedAt.delete(name);
        logger.debug(`${this.label(record)}: ${name} left`);
        await this.fire(TRIGGERS.PLAYER_LEFT, record, {
          ...base,
          player: name,
          minutes_played: since === undefined ? null : Math.round((now - since) / 60_000),
        });
      }
    } else {
      const delta = status.online - beforeOnline;
      const key = delta > 0 ? TRIGGERS.PLAYER_JOINED : TRIGGERS.PLAYER_LEFT;
      for (let i = 0; i < Math.min(Math.abs(delta), MAX_EVENTS_PER_READING); i += 1) {
        logger.debug(`${this.label(record)}: a player ${delta > 0 ? 'joined' : 'left'}`);
        await this.fire(
          key,
          record,
          delta > 0 ? { ...base, player: '' } : { ...base, player: '', minutes_played: null },
        );
      }
    }
    if (beforeOnline > 0 && status.online === 0) {
      await this.fire(TRIGGERS.SERVER_EMPTY, record, { players_max: status.max });
    }
    if (status.max > 0 && status.online >= status.max && beforeOnline < status.max) {
      await this.fire(TRIGGERS.SERVER_FULL, record, base);
    }
  }

  async fire(key, record, data) {
    try {
      await this.gladys.publishSceneEvent(key, {
        device: deviceIds(this.gladys, record.server.slot).device,
        server: serverName(record.server),
        game: gameLabel(record.server.type),
        ...data,
      });
      this.resolved('scene-event');
    } catch (err) {
      this.problem('scene-event', `Scene event ${key} refused: ${err.message}`);
    }
  }

  // --- Publishing to Gladys ----------------------------------------------------------

  /**
   * The states of a server, to its device if the user added it. Only the
   * changes, and every value once per heartbeat (SDK publishChangedStates).
   */
  async publishStates(record, { created = false } = {}) {
    const externalId = deviceIds(this.gladys, record.server.slot).device;
    if (!created && !this.createdDevices().has(externalId)) {
      return;
    }
    const states = featureStates(this.gladys, record, this.language)
      .filter((entry) => entry.state !== undefined || entry.text !== undefined)
      .map(({ externalId: id, state, text }) =>
        text === undefined
          ? { device_feature_external_id: id, state }
          : { device_feature_external_id: id, text },
      );
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.resolved('states');
    } catch (err) {
      this.problem('states', `States of ${this.label(record)} refused: ${err.message}`);
    }
  }

  /** The periodic tail of a reading: transports, connection status, widget. */
  async afterChanges(widgetChanged) {
    await this.publishTransports();
    await this.publishConnectionStatus();
    if (widgetChanged) {
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  async publishTransports() {
    const entries = [];
    for (const record of this.records.values()) {
      if (record.reachable === null) {
        continue;
      }
      const externalId = deviceIds(this.gladys, record.server.slot).device;
      // A single lost answer is not an outage.
      const transport = record.down
        ? DEVICE_TRANSPORTS.UNREACHABLE
        : isLocalHost(record.server.address.host)
          ? DEVICE_TRANSPORTS.LOCAL
          : DEVICE_TRANSPORTS.CLOUD;
      if (this.transports.get(externalId) !== transport) {
        entries.push({ external_id: externalId, transport });
      }
    }
    if (entries.length === 0) {
      return;
    }
    try {
      await this.gladys.publishTransports(entries);
      for (const entry of entries) {
        this.transports.set(entry.external_id, entry.transport);
      }
      this.resolved('transports');
    } catch (err) {
      this.problem('transports', `Transports refused: ${err.message}`);
    }
  }

  /** The configuration slots that cannot be read, one text each. */
  invalidTexts(language) {
    return this.config.invalid.map(({ slot, reason }) =>
      labelled(`#${slot}`, pick(INVALID_TEXT[reason], language), language),
    );
  }

  /** The status under the integration name: connected while a server answers. */
  connectionStatus() {
    const { servers, invalid } = this.config;
    const records = [...this.records.values()];
    // One lost answer is not an outage: only a server down counts.
    const failing = records.filter((record) => record.down);
    if (servers.length > 0 && failing.length === 0 && invalid.length === 0) {
      return { connected: true };
    }
    const message = {};
    for (const language of Object.keys(CONNECTION_TEXT.noServer)) {
      const parts = failing.map((record) =>
        labelled(
          serverName(record.server),
          pick(ERROR_TEXT[record.error.kind], language),
          language,
        ),
      );
      parts.push(...this.invalidTexts(language));
      if (servers.length === 0 && invalid.length === 0) {
        parts.push(pick(CONNECTION_TEXT.noServer, language));
      }
      message[language] = parts.join(' · ').slice(0, 200);
    }
    const answering = records.filter((record) => !record.down).length;
    return { connected: answering > 0, message };
  }

  async publishConnectionStatus() {
    const status = this.connectionStatus();
    const key = JSON.stringify(status);
    if (key === this.connection) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(status.connected, status.message);
      this.connection = key;
      this.resolved('connection-status');
    } catch (err) {
      this.problem('connection-status', `Connection status refused: ${err.message}`);
    }
  }

  // --- Scene action and reports ----------------------------------------------------------

  /**
   * "Read a game server": read it now, and return what a scene message needs.
   * @returns {Promise<object>} the outputs of the scene action
   */
  async readForScene(deviceExternalId) {
    const language = this.language;
    if (this.records.size === 0) {
      throw new Error(pick(ACTION_TEXT.noServer, language));
    }
    const record = this.recordOf(deviceExternalId);
    if (!record) {
      throw new Error(pick(ACTION_TEXT.unknownServer, language));
    }
    await this.pollOne(record);
    const { status } = record;
    const live = record.reachable === true && status;
    return {
      online: Boolean(live),
      players_online: live ? status.online : 0,
      players_max: status ? status.max : 0,
      players: live ? playersText(status, language) : '',
      map: status?.map ?? '',
      server_name: status?.name ?? '',
      version: status?.version ?? '',
      latency: live ? status.latencyMs : 0,
      server: serverName(record.server),
      game: gameLabel(record.server.type),
    };
  }

  /** "Test the connection": read every server now, one line each. */
  async testConnection() {
    await this.pollAll();
    const message = {};
    for (const [language, text] of Object.entries(REPORT_TEXT)) {
      const lines = [...this.records.values()].map((record) => {
        const name = serverName(record.server);
        if (record.error) {
          return labelled(name, pick(ERROR_TEXT[record.error.kind], language), language);
        }
        const { status } = record;
        const parts = [
          gameLabel(record.server.type),
          status.max > 0 ? text.players(status.online, status.max) : text.count(status.online),
          text.latency(status.latencyMs),
        ];
        if (status.map) {
          parts.push(text.map(status.map));
        }
        return labelled(name, parts.join(', '), language);
      });
      lines.push(...this.invalidTexts(language));
      if (lines.length === 0) {
        lines.push(pick(CONNECTION_TEXT.noServer, language));
      }
      message[language] = lines.join('\n');
    }
    return message;
  }

  /** What the widget shows, for one server or all of them. */
  view(deviceExternalId) {
    if (!deviceExternalId) {
      return [...this.records.values()];
    }
    const record = this.recordOf(deviceExternalId);
    return record ? [record] : [];
  }
}
