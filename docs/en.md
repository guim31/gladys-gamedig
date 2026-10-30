# Game Servers (GameDig)

Follow your **game servers** from Gladys: whether each one is online, how many
players are on it and who, the map, the server name, the version and the
ping. Gladys can react when a player joins or leaves, when the server goes
offline or comes back, empties or fills up. Valheim, Counter-Strike, ARK,
Rust, Satisfactory, Palworld, 7 Days to Die, Project Zomboid, Quake… more
than 300 games, at home (a NAS, a PC, a Raspberry Pi) or rented on the
Internet.

The integration reads each server like the server browser of the game does,
through the open source [GameDig](https://github.com/gamedig/node-gamedig)
library: no game account, no plugin, nothing to install on the server. It is
not affiliated with GameDig nor with any game publisher.

For a **Minecraft** server, prefer the dedicated
[Minecraft Server](https://github.com/guim31/gladys-minecraft) integration
(`gladys-minecraft`): it reads the complete list of players through RCON and
can send chat messages.

> **Tested against a real OpenArena server only: feedback welcome.** The
> other games go through the same library but were not tried on a real
> server, and nothing was tested inside a real Gladys yet. If something does
> not work as described, please say so on the
> [Gladys forum](https://community.gladysassistant.com) or in the
> [issues](https://github.com/guim31/gladys-gamedig/issues).

## What you need

- Gladys Assistant 5.1.0 or later.
- A game server reachable from Gladys, whose game is in the
  [GameDig games list](https://github.com/gamedig/node-gamedig/blob/master/GAMES_LIST.md).
- Its **query** must answer. It does by default for most games; some need a
  setting:
  - **Valheim**: start the server in public mode (`-public 1`);
  - **Palworld**: `RESTAPIEnabled=True`, and the admin password in the
    configuration;
  - **Terraria**: the TShock mod and a REST token;
  - **Farming Simulator**: the token of the web interface of the server;
  - **7 Days to Die**, **Counter-Strike 2**, **Conan Exiles**: they give the
    number of players, not their names.
- A firewall in front of the server must let the query port through (often a
  UDP port next to the game port: Valheim 2457, ARK 27015…).

## Set up

1. Install the integration from the Gladys catalog.
2. In **Configuration**, for each server (up to four):
   - pick the **Game**. Not in the list? Pick **Other (GameDig type)** and
     type its id from the GameDig games list (`barotrauma`, `insurgency`…) in
     **GameDig type**;
   - enter the **Address**: `192.168.1.20`, `game.example.com`, and
     `:port` when the port is not the default one of the game. Usually the game port: GameDig derives the query port of most games from it, and the query port itself works too. Palworld wants the port of its REST API (8212), Farming Simulator that of its web interface (8080);
   - optionally a **Name shown in Gladys**, and the **Password or token** of
     the few games that need one.
3. Choose the **Reading interval** (1 minute by default), and if needed the
   **Answer timeout** and the **Attempts per reading** for a distant server.
4. Save, then click **Test the connection**: one line per server, with its
   game, players, ping and map. The result shows in red as soon as a server
   does not answer.
5. In **Discovery**, add the devices you want to keep in Gladys (history,
   dashboard). The scene triggers and the widget work even without them.

## The device of each server

| Feature        | What it shows                                                     |
| -------------- | ----------------------------------------------------------------- |
| Online         | 1 when the server answers, 0 after two readings without an answer |
| Players online | people playing now (bots are not counted)                         |
| Player slots   | the maximum number of players                                     |
| Players        | who is playing, or how many when the game gives no names          |
| Map            | the current map or world, when the game gives one                 |
| Server name    | the name the server announces, when the game gives one            |
| Version        | the version of the game server, when the game gives one           |
| Ping           | the time the query took, in milliseconds                          |

**Map**, **Server name** and **Version** only appear once the game has given
a value: Mumble has no map, many games no version. A server read for the
first time while offline gets them later; Gladys then offers **Update** on the
device in the Discovery tab.

The names of the features are written in the **Language of the names** of the
configuration, when the device is created.

## Dashboard

The **Game servers** widget shows one tile per server (players online and
slots, green when it answers, red when it is offline), then the state and map
of each server and who is playing. Every server by default, or the one chosen
in the widget settings.

## Scenes

### Triggers

- **A player joined the game server**: with the **Player name** when the game
  gives the names of everyone online, else with an empty name. The
  **Player name (empty: anyone)** filter is compared exactly, case included.
- **A player left the game server**: also gives the **Minutes played** when
  the player was seen joining.
- **The game server went offline**: after two readings without an answer,
  15 seconds apart. No "left" event for each player then.
- **The game server is back online**: with the **Minutes offline**.
- **The game server is empty**: the last player left.
- **The game server is full**: every player slot is taken.

Every trigger can be limited to one server, and gives the server name and the game to the following actions, and the player counts except when the server goes offline. A server already offline when the integration starts fires no "went offline". A server restarting
with many players fires ten "joined" events at most.

### Actions

- **Read a game server**: queries it now and passes its state to the next
  steps: Online, Players online, Player slots, Players, Map, Version, Ping…
  For a message ("3 players on Valheim: Ann, Bob, Chris"), or a **Continue
  only if** condition on Online.

### Scene ideas

- **Someone joined our server** → a notification with the player name and the
  server name, picked from the variables of the trigger.
- **The game server went offline** → a Telegram message to whoever runs it,
  and turn on the smart plug of the server after 5 minutes.
- **Friday 9 pm** → **Read a game server** → **Continue only if** Online →
  a message "already N players on the map", with Players online and Map.
- **The game server is empty** at night → turn off the plug of the gaming PC.

## Troubleshooting

- **Does not answer (game, port, query enabled?)**: the right game? The right
  port (try the game port and the query port)? The query enabled on the
  server (Valheim `-public 1`, Palworld REST API)? A firewall letting UDP
  through? `docker logs` of the integration with `LOG_LEVEL=debug` shows each
  reading.
- **Name not found**: the name of the address does not resolve from Gladys.
- **Unknown GameDig type**: the id typed in **GameDig type** is not in the
  GameDig games list.
- **Players gives a count, not names**: the game does not give them
  (Counter-Strike 2, 7 Days to Die, DayZ…). The triggers then work by count.
- **Players online is 0 while bots play**: bots are not counted, on purpose.

## Limits

- Read every minute by default (30 seconds at the fastest): a player who stays
  less than an interval may not be seen, and the events come one reading
  late.
- ARK: Survival Ascended and Factorio are not in the list: GameDig reads them through the lobby API of their publisher, which only knows public servers and would receive the address. They remain possible through **Other (GameDig type)** (`asa`, `factorio`).
- Up to four servers. GameDig reads what each game publishes: names, map and
  version depend on the game, and some games publish fewer players than are
  online.
- The query is a few small packets per reading: it never loads a server, and
  public servers do not limit it at this pace.
- Nothing is changed on the servers: the integration only reads them.
- The secrets typed in the configuration only go to the game server they
  belong to, and never appear in the logs.

GameDig is © its contributors, MIT licence.
