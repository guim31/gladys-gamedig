// -----------------------------------------------------------------------------
// The games offered in the configuration, and the GameDig types behind them.
//
// GameDig knows more than 300 games (its `games` table); the drop-down list
// keeps the dedicated servers people host at home or rent, and "Other" opens
// a free field for any other GameDig type (or `protocol-<name>`). The values
// are GameDig ids: stored in the users' configuration, they never change
// (test/games.test.js checks each one exists in the installed GameDig).
// -----------------------------------------------------------------------------

import { games as GAMEDIG_GAMES, protocols as GAMEDIG_PROTOCOLS } from 'gamedig';

export const OTHER_GAME = 'other';

// Value: GameDig id. Label: the game's own name (brands are not translated).
export const COMMON_GAMES = [
  ['valheim', 'Valheim'],
  ['minecraft', 'Minecraft (Java Edition)'],
  ['mbe', 'Minecraft (Bedrock Edition)'],
  ['counterstrike2', 'Counter-Strike 2'],
  ['css', 'Counter-Strike: Source'],
  ['counterstrike16', 'Counter-Strike 1.6'],
  ['teamfortress2', 'Team Fortress 2'],
  ['garrysmod', "Garry's Mod"],
  ['l4d2', 'Left 4 Dead 2'],
  ['rust', 'Rust'],
  ['ase', 'ARK: Survival Evolved'],
  ['satisfactory', 'Satisfactory'],
  ['palworld', 'Palworld'],
  ['terrariatshock', 'Terraria (TShock)'],
  ['sdtd', '7 Days to Die'],
  ['projectzomboid', 'Project Zomboid'],
  ['vrising', 'V Rising'],
  ['enshrouded', 'Enshrouded'],
  ['sotf', 'Sons Of The Forest'],
  ['conanexiles', 'Conan Exiles'],
  ['dayz', 'DayZ'],
  ['arma3', 'Arma 3'],
  ['unturned', 'Unturned'],
  ['spaceengineers', 'Space Engineers'],
  ['dst', "Don't Starve Together"],
  ['corekeeper', 'Core Keeper'],
  ['insurgencysandstorm', 'Insurgency: Sandstorm'],
  ['squad', 'Squad'],
  ['ets2', 'Euro Truck Simulator 2'],
  ['farmingsimulator25', 'Farming Simulator 25'],
  ['q3a', 'Quake III Arena'],
  ['openarena', 'OpenArena'],
  ['quakelive', 'Quake Live'],
  ['mumble', 'Mumble'],
];

export const GAME_VALUES = [...COMMON_GAMES.map(([value]) => value), OTHER_GAME];

const LABELS = new Map(COMMON_GAMES);

// Not in the list: ARK: Survival Ascended and Factorio, which GameDig reads
// through the lobby API of their publisher (Epic, Wube): a server at home is
// never found there, and its address would leave for a third party. Still
// possible through "Other".

// Protocols that read a secret (GameDig options): Palworld's REST API wants
// the admin password, these ones an API token.
const TOKEN_PROTOCOLS = new Set(['terraria', 'satisfactory', 'farmingsimulator']);

/** Whether GameDig knows this type (a game id or `protocol-<name>`). */
export function isKnownType(type) {
  if (typeof type !== 'string' || type === '') {
    return false;
  }
  if (type.startsWith('protocol-')) {
    return Object.hasOwn(GAMEDIG_PROTOCOLS, type.slice('protocol-'.length));
  }
  return Object.hasOwn(GAMEDIG_GAMES, type);
}

/** The protocol behind a type. */
export function protocolOf(type) {
  if (type.startsWith('protocol-')) {
    return type.slice('protocol-'.length);
  }
  return GAMEDIG_GAMES[type]?.options?.protocol ?? null;
}

/** The name of a game, for the device name and the scene variables. */
export function gameLabel(type) {
  if (LABELS.has(type)) {
    return LABELS.get(type);
  }
  if (type.startsWith('protocol-')) {
    return type.slice('protocol-'.length);
  }
  return GAMEDIG_GAMES[type]?.name ?? type;
}

/**
 * Whether GameDig tries another port than a typed one: a query port offset
 * (Valheim: game port + 1), or a fixed query port (Conan Exiles: 27015).
 */
export function triesOtherPorts(type) {
  const options = GAMEDIG_GAMES[type]?.options ?? {};
  const offsets = [options.port_query_offset].flat().filter(Boolean);
  return offsets.length > 0 || Boolean(options.port_query);
}

/** The GameDig options carrying the secret of the configuration, if any. */
export function secretOptions(type, secret) {
  if (!secret) {
    return {};
  }
  const protocol = protocolOf(type);
  if (protocol === 'palworld') {
    // GameDig: "username (currently always admin)", the admin password.
    return { username: 'admin', password: secret };
  }
  if (TOKEN_PROTOCOLS.has(protocol)) {
    return { token: secret };
  }
  return {};
}
