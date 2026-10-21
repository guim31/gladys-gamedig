// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `game_servers`.
//
// The use case: the tablet in the living room shows whether the Valheim
// server of the group is up, and who is on it. So: one tile per server
// (players online / slots, green when it answers, red when it is offline),
// and a status list with each server's state and map and who is playing.
//
// Budget (8 components): four tiles at most (four servers), one status list
// of ten rows at most. The values are sent as values, not bound to device
// features, so the widget works before the devices are added to Gladys.
// Every server by default, or the one chosen in the widget settings. The core
// gives the user's language: texts are localized with it.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { serverName } from './devices.js';
import { WIDGET_KEY } from './hub.js';
import { pick } from './texts.js';

export const TEXT = {
  pick: {
    en: 'Choose the game and enter the address of your server in the configuration of the integration.',
    fr: "Choisissez le jeu et saisissez l'adresse de votre serveur dans la configuration de l'intégration.",
    de: 'Wähle das Spiel und gib die Adresse deines Servers in der Konfiguration der Integration ein.',
    es: 'Elija el juego e introduzca la dirección de su servidor en la configuración de la integración.',
  },
  unknown: {
    en: 'This server is no longer in the configuration: choose another one in the widget settings.',
    fr: "Ce serveur n'est plus dans la configuration : choisissez-en un autre dans les réglages du widget.",
    de: 'Dieser Server ist nicht mehr in der Konfiguration: Wähle einen anderen in den Widget-Einstellungen.',
    es: 'Este servidor ya no está en la configuración: elija otro en la configuración del widget.',
  },
  players: { en: 'Players', fr: 'Joueurs', de: 'Spieler', es: 'Jugadores' },
  latency: { en: 'Ping', fr: 'Ping', de: 'Ping', es: 'Ping' },
  online: { en: 'Online', fr: 'En ligne', de: 'Online', es: 'En línea' },
  offline: { en: 'Offline', fr: 'Hors ligne', de: 'Offline', es: 'Desconectado' },
  waiting: { en: 'Waiting…', fr: 'En attente…', de: 'Warte…', es: 'Esperando…' },
  nobody: { en: 'Nobody', fr: 'Personne', de: 'Niemand', es: 'Nadie' },
  count: {
    en: 'names not given',
    fr: 'noms non fournis',
    de: 'Namen nicht geliefert',
    es: 'nombres no facilitados',
  },
};

const t = (text, language) => pick(text, language);
const fit = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

function message(text, language) {
  return {
    ttl_seconds: 300,
    components: [{ type: 'text', variant: 'body', text: t(text, language) }],
  };
}

// One lost answer is not an outage: the last reading stays until the server is down.
const answering = (record) => !record.down && record.status !== null;

/** The tile of one server: players online / slots. */
function serverTile(record, label, language) {
  if (answering(record)) {
    const { online, max } = record.status;
    return {
      type: 'value',
      value: fit(max > 0 ? `${online}/${max}` : String(online), 12),
      label: fit(label, 24),
      icon: 'users',
      color: WIDGET_COLORS.SUCCESS,
    };
  }
  if (record.down) {
    return {
      type: 'value',
      value: t(TEXT.offline, language),
      label: fit(label, 24),
      icon: 'alert-triangle',
      color: WIDGET_COLORS.DANGER,
    };
  }
  return {
    type: 'value',
    value: '…',
    label: fit(label, 24),
    icon: 'clock',
    color: WIDGET_COLORS.NEUTRAL,
  };
}

/** The status row of one server: online with its map, or offline. */
function stateRow(record, language) {
  const label = fit(serverName(record.server), 40);
  if (answering(record)) {
    const { map } = record.status;
    return {
      label,
      icon: 'check-circle',
      value: fit(map ? `${t(TEXT.online, language)} · ${map}` : t(TEXT.online, language), 40),
      color: WIDGET_COLORS.SUCCESS,
    };
  }
  if (record.down) {
    return {
      label,
      icon: 'x-circle',
      value: t(TEXT.offline, language),
      color: WIDGET_COLORS.DANGER,
    };
  }
  return { label, icon: 'clock', value: t(TEXT.waiting, language), color: WIDGET_COLORS.NEUTRAL };
}

/** Who is playing on one server, as one row (null: not answering). */
function playersRow(record, label, language) {
  if (!answering(record)) {
    return null;
  }
  const { status } = record;
  let value;
  if (status.online === 0) {
    value = t(TEXT.nobody, language);
  } else if (status.players.length > 0) {
    const missing = status.online - status.players.length;
    value = status.players.join(', ') + (missing > 0 ? ` +${missing}` : '');
  } else {
    value = `${status.online} · ${t(TEXT.count, language)}`;
  }
  return {
    label: fit(label, 40),
    icon: 'user',
    value: fit(value, 40),
    color: WIDGET_COLORS.NEUTRAL,
  };
}

async function get(hub, { settings, language = 'en' } = {}) {
  if (hub.records.size === 0) {
    return message(TEXT.pick, language);
  }
  const records = hub.view(settings?.device).slice(0, 4);
  if (records.length === 0) {
    return message(TEXT.unknown, language);
  }
  const single = records.length === 1;
  const components = [];
  for (const record of records) {
    components.push(
      serverTile(record, single ? t(TEXT.players, language) : serverName(record.server), language),
    );
  }
  if (single && answering(records[0])) {
    components.push({
      type: 'value',
      value: records[0].status.latencyMs,
      unit: 'ms',
      label: t(TEXT.latency, language),
      icon: 'activity',
    });
  }
  const items = [];
  for (const record of records) {
    items.push(stateRow(record, language));
    const row = playersRow(
      record,
      single
        ? t(TEXT.players, language)
        : `${t(TEXT.players, language)} · ${serverName(record.server)}`,
      language,
    );
    if (row) {
      items.push(row);
    }
  }
  components.push({ type: 'status', items: items.slice(0, 10) });
  return { ttl_seconds: 60, components };
}

export const WIDGETS = {
  [WIDGET_KEY]: { get },
};
