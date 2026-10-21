// -----------------------------------------------------------------------------
// Server addresses, as a player types them in the server browser of a game:
// `192.0.2.10`, `game.example.com`, `game.example.com:2457`,
// `[2001:db8::1]:27015`. The port is optional: GameDig knows the default game
// port and query port of each game. (From guim31/gladys-minecraft.)
// -----------------------------------------------------------------------------

import { isIP } from 'node:net';

const MAX_HOST_LENGTH = 253;

/**
 * Parse an address typed in the configuration.
 * @param {unknown} raw
 * @returns {{ host: string, port: number|null } | null} null when unusable
 */
export function parseAddress(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  // A pasted `steam://connect/` or `http://` prefix, or a trailing slash, is noise.
  const text = raw
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\/(connect\/)?/iu, '')
    .replace(/\/+$/u, '');
  if (!text || /[\s/@?#]/u.test(text)) {
    return null;
  }
  let host;
  let port = null;
  const bracketed = text.match(/^\[([0-9a-f:.]+)\](?::(\d+))?$/iu);
  if (bracketed) {
    [, host] = bracketed;
    port = bracketed[2] === undefined ? null : Number(bracketed[2]);
  } else if (isIP(text) === 6) {
    host = text; // a bare IPv6 address: no port possible
  } else {
    const match = text.match(/^([^:]+)(?::(\d+))?$/u);
    if (!match) {
      return null;
    }
    [, host] = match;
    port = match[2] === undefined ? null : Number(match[2]);
  }
  if (port !== null && !(port >= 1 && port <= 65535)) {
    return null;
  }
  host = host.toLowerCase();
  if (
    host.length > MAX_HOST_LENGTH ||
    (isIP(host) === 0 &&
      !/^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?)*\.?$/u.test(host))
  ) {
    return null;
  }
  return { host, port };
}

/** The address as shown to the user. */
export function formatAddress({ host, port }) {
  const shown = isIP(host) === 6 ? `[${host}]` : host;
  return port === null ? shown : `${shown}:${port}`;
}
