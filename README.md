# Game Servers (GameDig) for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration that follows
**game servers** through the [GameDig](https://github.com/gamedig/node-gamedig)
library: more than 300 games (Valheim, Counter-Strike 2, ARK, Rust,
Satisfactory, Palworld, Terraria, 7 Days to Die, Quake…), at home or on the
Internet, without any game account.

> **Tested against a real OpenArena server only: feedback welcome.** See
> [what was checked](#checked-on-a-real-server-and-what-was-not).

For Minecraft, prefer [gladys-minecraft](https://github.com/guim31/gladys-minecraft):
it reads the complete player list through RCON and sends chat messages.

## Features

- **One device per server** (up to four): Online, Players online (bots left
  out), Player slots, Players (names, or a count when the game gives none),
  Map, Server name and Version (once the game gives them), Ping.
- **Scene triggers**: a player joined (with the name when the game gives it),
  a player left (with the minutes played), the server went offline, is back
  online, is empty, is full.
- **Scene action** "Read a game server": its state for the next steps of a
  scene (a message, a "Continue only if" condition).
- **Dashboard widget** "Game servers": one tile per server, its state, map and
  who is playing.
- **Test the connection** button: one line per server.
- A drop-down list of 36 common games, and any other GameDig type (or
  `protocol-<name>`) in a free field. Reading interval, answer timeout and
  attempts can be set. Every text in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.1.0 or later.
- A game server whose query answers (enabled by default for most games;
  Valheim needs `-public 1`, Palworld its REST API and admin password,
  Terraria TShock and Farming Simulator a token). See the
  [GameDig games list](https://github.com/gamedig/node-gamedig/blob/master/GAMES_LIST.md)
  and its notes.

## Installation

1. In Gladys, open **Integrations** → **Install from GitHub** and enter the
   address of this repository: `https://github.com/guim31/gladys-gamedig`
   (or install **Game Servers (GameDig)** from the catalog once it is listed).
2. In **Configuration**, for each server, pick the game, enter its address
   (`192.168.1.20`, `game.example.com:2457`…) and optionally a name. Save,
   then click **Test the connection**.
3. Open the **Discover** tab and add the devices.

The user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)); Gladys
links it from the Configuration screen.

## How it works

The container queries each configured server on its own timer (1 minute by
default, `should_poll: false`: Gladys never polls), with GameDig and the
options of the configuration (timeout per packet, attempts). A first failure
is read again 15 seconds later; two failures in a row make the server
offline. States go to Gladys only when they change (and every 6 hours, so
Gladys never shows them as stale), and only to the devices the user added;
the scene events and the widget work for every configured server.

Joins and leaves are found by comparing the names of two readings when the
game names every player online, else by comparing the counts. Bots (the
`bots` list of GameDig) are never counted as players.

## Checked on a real server, and what was not

Checked on 21 October 2026, in the Docker image of the integration run with
the constraints of the Gladys sandbox (`--cap-drop ALL`,
`--security-opt no-new-privileges`, `--read-only`, `--memory 256m`,
`--pids-limit 256`, bridge network), against a real **OpenArena 0.8.8**
dedicated server in another container (`sago007/openarena`):

- the whole integration with the SDK's fake Gladys
  (`test/real/real-server.test.js`): device, states, map, server name,
  version and ping read; two bots added through RCON not counted as players;
  a closed port reported as "does not answer", an unknown name as "name not
  found", both offline after two readings;
- the recordings of `test/fixtures/real/` come from that server;
- without Gladys, the container retries the connection with a back-off, never
  crashes, writes no token; 26 MiB of memory at rest.

Not checked: any other game than OpenArena (the other protocols are GameDig's,
used as they are), a human player joining (the joins and leaves are tested
with the shape GameDig gives for Quake 3 players), and the integration inside
a real Gladys.

## Limitations

- One reading a minute by default (30 seconds at the fastest): a short visit
  may be missed, and the events come one reading late.
- Names, map and version depend on what each game publishes. Counter-Strike
  2, 7 Days to Die, DayZ, Conan Exiles give no names: the triggers then work
  by count, without a name.
- Up to four servers.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
node scripts/probe.mjs openarena 192.0.2.10        # read a real server
GAMEDIG_REAL_HOST=192.0.2.10 npm run test:real     # the integration against it
```

See [`CLAUDE.md`](CLAUDE.md) for the architecture and the rules of the
repository.

## Credits

- [GameDig](https://github.com/gamedig/node-gamedig) (MIT), which does all the
  game protocols. Its games list and notes are the reference of this
  integration.
- The structure of the hub, tests and documentation comes from
  [gladys-minecraft](https://github.com/guim31/gladys-minecraft).
- The cover is an original pictogram: GameDig publishes no logo under a free
  licence, and the integration covers many games.

## Disclaimer

This project is not affiliated with GameDig nor with any game publisher. Game
names are trademarks of their owners.

## License

[Apache-2.0](LICENSE).
