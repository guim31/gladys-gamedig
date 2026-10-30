# Game Servers (GameDig)

Verfolge deine **Spieleserver** in Gladys: ob jeder online ist, wie viele
Spieler darauf sind und wer, die Karte, den Servernamen, die Version und den
Ping. Gladys kann reagieren, wenn ein Spieler kommt oder geht, wenn der
Server ausfällt oder zurückkommt, sich leert oder voll wird. Valheim,
Counter-Strike, ARK, Rust, Satisfactory, Palworld, 7 Days to Die, Project
Zomboid, Quake… mehr als 300 Spiele, zu Hause (ein NAS, ein PC, ein Raspberry
Pi) oder gemietet im Internet.

Die Integration liest jeden Server so, wie es die Serverliste des Spiels tut,
über die freie Bibliothek [GameDig](https://github.com/gamedig/node-gamedig):
kein Spielkonto, kein Plugin, nichts auf dem Server zu installieren. Die
Integration ist weder mit GameDig noch mit einem Spieleverlag verbunden.

Für einen **Minecraft**-Server nimm lieber die eigene Integration
[Minecraft Server](https://github.com/guim31/gladys-minecraft)
(`gladys-minecraft`): Diese liest die vollständige Spielerliste per RCON und
kann Chatnachrichten senden.

> **Nur mit einem echten OpenArena-Server getestet: Rückmeldungen
> willkommen.** Die anderen Spiele laufen über dieselbe Bibliothek, wurden
> aber nicht an einem echten Server ausprobiert, und in einem echten Gladys
> wurde noch nichts getestet. Wenn etwas nicht wie beschrieben funktioniert,
> sag es bitte im [Gladys-Forum](https://community.gladysassistant.com) oder
> in den [Issues](https://github.com/guim31/gladys-gamedig/issues).

## Was du brauchst

- Gladys Assistant 5.1.0 oder neuer.
- Einen von Gladys erreichbaren Spieleserver, dessen Spiel in der
  [Spieleliste von GameDig](https://github.com/gamedig/node-gamedig/blob/master/GAMES_LIST.md)
  steht.
- Seine **Abfragen** müssen antworten. Bei den meisten Spielen ist das
  standardmäßig so; manche brauchen eine Einstellung:
  - **Valheim**: den Server im öffentlichen Modus starten (`-public 1`);
  - **Palworld**: `RESTAPIEnabled=True` und das Admin-Passwort in der
    Konfiguration;
  - **Terraria**: die Mod TShock und ein REST-Token;
  - **Farming Simulator**: das Token der Weboberfläche des Servers;
  - **7 Days to Die**, **Counter-Strike 2**, **Conan Exiles**: Diese liefern die
    Zahl der Spieler, nicht deren Namen.
- Eine Firewall vor dem Server muss den Abfrageport durchlassen (oft ein
  UDP-Port neben dem Spielport: Valheim 2457, ARK 27015…).

## Einrichtung

1. Installiere die Integration aus dem Gladys-Katalog.
2. In **Konfiguration**, für jeden Server (bis zu vier):
   - wähle das **Spiel**. Nicht in der Liste? Wähle **Anderes (GameDig-Typ)**
     und gib seine Kennung aus der Spieleliste von GameDig (`barotrauma`,
     `insurgency`…) unter **GameDig-Typ** ein;
   - gib die **Adresse** ein: `192.168.1.20`, `game.example.com` und
     `:Port`, wenn der Port nicht der Standard des Spiels ist. Meist der Spielport: GameDig leitet daraus bei den meisten Spielen den Abfrageport ab, und der Abfrageport selbst geht auch. Palworld will den Port seiner REST-API (8212), Farming Simulator den seiner Weboberfläche (8080);
   - optional einen **In Gladys angezeigten Namen** und das **Passwort oder
     Token** der wenigen Spiele, die eines brauchen.
3. Wähle das **Abfrageintervall** (standardmäßig 1 Minute) und bei Bedarf die
   **Wartezeit auf Antworten** und die **Versuche pro Abfrage** für einen
   weit entfernten Server.
4. Speichere und klicke auf **Verbindung testen**: eine Zeile pro Server, mit
   Spiel, Spielern, Ping und Karte. Das Ergebnis erscheint rot, sobald ein
   Server nicht antwortet.
5. Füge unter **Erkennung** die Geräte hinzu, die du in Gladys behalten
   willst (Verlauf, Dashboard). Die Szenen-Auslöser und das Widget
   funktionieren auch ohne sie.

## Das Gerät jedes Servers

| Funktion       | Was sie zeigt                                                   |
| -------------- | --------------------------------------------------------------- |
| Online         | 1, wenn der Server antwortet, 0 nach zwei Abfragen ohne Antwort |
| Spieler online | die Menschen, die gerade spielen (Bots zählen nicht)            |
| Spielerplätze  | die höchste Zahl an Spielern                                    |
| Spieler        | wer spielt, oder wie viele, wenn das Spiel keine Namen liefert  |
| Karte          | die aktuelle Karte oder Welt, wenn das Spiel sie liefert        |
| Servername     | der Name, den der Server meldet, wenn das Spiel ihn liefert     |
| Version        | die Version des Spieleservers, wenn das Spiel sie liefert       |
| Ping           | die Dauer der Abfrage, in Millisekunden                         |

**Karte**, **Servername** und **Version** erscheinen erst, wenn das Spiel
einen Wert geliefert hat: Mumble hat keine Karte, viele Spiele keine Version.
Ein Server, der beim ersten Lesen offline ist, bekommt sie später; Gladys
bietet dann unter Erkennung **Aktualisieren** für das Gerät an.

Die Namen der Funktionen werden in der **Sprache der Namen** der
Konfiguration geschrieben, wenn das Gerät erstellt wird.

## Dashboard

Das Widget **Spieleserver** zeigt eine Kachel pro Server (Spieler online und
Plätze, grün, wenn er antwortet, rot, wenn er offline ist), dann Zustand und
Karte jedes Servers und wer spielt. Standardmäßig alle Server, oder der in
den Widget-Einstellungen gewählte.

## Szenen

### Auslöser

- **Ein Spieler ist dem Spieleserver beigetreten**: mit dem **Spielernamen**,
  wenn das Spiel die Namen aller Spieler liefert, sonst mit leerem Namen. Der
  Filter **Spielername (leer: beliebig)** wird exakt verglichen, mit Groß- und
  Kleinschreibung.
- **Ein Spieler hat den Spieleserver verlassen**: liefert auch die
  **Gespielten Minuten**, wenn der Spieler beim Beitreten gesehen wurde.
- **Der Spieleserver ist offline**: nach zwei Abfragen ohne Antwort, im
  Abstand von 15 Sekunden. Dann kein Verlassen für jeden Spieler.
- **Der Spieleserver ist wieder online**: mit den **Minuten offline**.
- **Der Spieleserver ist leer**: Der letzte Spieler ist gegangen.
- **Der Spieleserver ist voll**: Alle Spielerplätze sind belegt.

Jeder Auslöser lässt sich auf einen Server beschränken und gibt den folgenden Aktionen den Servernamen und das Spiel weiter, und die Spielerzahlen außer beim Ausfall. Ein Server, der beim Start der Integration schon offline ist, löst kein „offline“ aus. Ein Server,
der mit vielen Spielern neu startet, löst höchstens zehn Beitritte aus.

### Aktionen

- **Spieleserver abfragen**: fragt ihn sofort ab und gibt seinen Zustand an
  die nächsten Schritte weiter: Online, Spieler online, Spielerplätze,
  Spieler, Karte, Version, Ping… Für eine Nachricht („3 Spieler auf Valheim:
  Ann, Bob, Chris“) oder eine Bedingung **Nur fortfahren, wenn** auf Online.

### Ideen für Szenen

- **Jemand ist unserem Server beigetreten** → eine Benachrichtigung mit dem
  Spielernamen und dem Servernamen, aus den Variablen des Auslösers gewählt.
- **Der Spieleserver ist offline** → eine Telegram-Nachricht an den, der ihn
  betreut, und nach 5 Minuten die Steckdose des Servers wieder einschalten.
- **Freitag 21 Uhr** → **Spieleserver abfragen** → **Nur fortfahren, wenn**
  Online → eine Nachricht „schon N Spieler auf der Karte“, mit Spieler online
  und Karte.
- **Der Spieleserver ist leer** in der Nacht → die Steckdose des Gaming-PCs
  ausschalten.

## Fehlerbehebung

- **Antwortet nicht (Spiel, Port, Abfragen aktiv?)**: das richtige Spiel? Der
  richtige Port (probiere Spielport und Abfrageport)? Die Abfragen auf dem
  Server aktiv (Valheim `-public 1`, REST-API von Palworld)? Eine Firewall,
  die UDP durchlässt? Die `docker logs` der Integration mit `LOG_LEVEL=debug`
  zeigen jede Abfrage.
- **Name nicht gefunden**: Der Name der Adresse lässt sich von Gladys aus
  nicht auflösen.
- **Unbekannter GameDig-Typ**: Die unter **GameDig-Typ** eingegebene Kennung
  steht nicht in der Spieleliste von GameDig.
- **Spieler zeigt eine Zahl, keine Namen**: Das Spiel liefert sie nicht
  (Counter-Strike 2, 7 Days to Die, DayZ…). Die Auslöser arbeiten dann mit der
  Zahl.
- **Spieler online ist 0, obwohl Bots spielen**: Bots zählen absichtlich
  nicht.

## Grenzen

- Standardmäßig jede Minute gelesen (höchstens alle 30 Sekunden): Ein
  Spieler, der kürzer als ein Intervall bleibt, wird vielleicht nicht
  gesehen, und die Ereignisse kommen eine Abfrage später.
- ARK: Survival Ascended und Factorio stehen nicht in der Liste: GameDig liest sie über die Lobby-API ihres Herausgebers, die nur öffentliche Server kennt und die Adresse erhalten würde. Über **Anderes (GameDig-Typ)** gehen sie weiterhin (`asa`, `factorio`).
- Bis zu vier Server. GameDig liest, was jedes Spiel veröffentlicht: Namen,
  Karte und Version hängen vom Spiel ab, und manche Spiele melden weniger
  Spieler, als online sind.
- Die Abfrage besteht aus wenigen kleinen Paketen: Das belastet nie einen
  Server, und öffentliche Server begrenzen sie in diesem Takt nicht.
- Auf den Servern wird nichts geändert: Die Integration liest sie nur.
- Die in der Konfiguration eingegebenen Geheimnisse gehen nur an ihren
  Spieleserver und erscheinen nie in den Protokollen.

GameDig ist © seine Mitwirkenden, MIT-Lizenz.
