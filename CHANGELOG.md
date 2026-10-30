# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Fixed

- **Test the connection** now fails, so Gladys shows the report in red, when a server does not
  answer, a slot cannot be read or no server is configured; green is kept for a test where every
  server answers.

## [1.0.0] - 2026-10-21

### Added

- Game servers in Gladys through GameDig (more than 300 games): up to four
  servers, picked from a list of 34 common games or by any GameDig type.
- One device per server: Online, Players online (bots left out), Player
  slots, Players (names, or a count when the game gives none), Map, Server
  name, Version and Ping.
- Scene triggers: a player joined, a player left, the server went offline, is
  back online, is empty, is full.
- Scene action "Read a game server", for messages and conditions.
- Dashboard widget "Game servers".
- "Test the connection" button, reading interval, answer timeout and attempts
  in the configuration; every text in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-gamedig/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-gamedig/releases/tag/v1.0.0
