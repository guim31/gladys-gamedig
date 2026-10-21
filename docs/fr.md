# Game Servers (GameDig)

Suivez vos **serveurs de jeu** depuis Gladys : si chacun est en ligne, combien
de joueurs y sont et lesquels, la carte, le nom du serveur, la version et le
ping. Gladys peut réagir quand un joueur arrive ou part, quand le serveur
tombe ou revient, se vide ou se remplit. Valheim, Counter-Strike, ARK, Rust,
Satisfactory, Palworld, 7 Days to Die, Project Zomboid, Quake… plus de 300
jeux, à la maison (un NAS, un PC, un Raspberry Pi) ou loués sur Internet.

L'intégration lit chaque serveur comme le fait le navigateur de serveurs du
jeu, grâce à la bibliothèque libre [GameDig](https://github.com/gamedig/node-gamedig) :
aucun compte de jeu, aucun plugin, rien à installer sur le serveur. Elle n'est
affiliée ni à GameDig ni à aucun éditeur de jeu.

Pour un serveur **Minecraft**, préférez l'intégration dédiée
[Minecraft Server](https://github.com/guim31/gladys-minecraft)
(`gladys-minecraft`) : elle lit la liste complète des joueurs par RCON et
peut envoyer des messages dans le chat.

> **Testée contre un vrai serveur OpenArena seulement : vos retours sont les
> bienvenus.** Les autres jeux passent par la même bibliothèque mais n'ont pas
> été essayés sur un vrai serveur, et rien n'a encore été testé dans un vrai
> Gladys. Si quelque chose ne marche pas comme décrit, dites-le sur le
> [forum Gladys](https://community.gladysassistant.com) ou dans les
> [issues](https://github.com/guim31/gladys-gamedig/issues).

## Ce qu'il vous faut

- Gladys Assistant 5.1.0 ou plus récent.
- Un serveur de jeu joignable depuis Gladys, dont le jeu figure dans la
  [liste des jeux de GameDig](https://github.com/gamedig/node-gamedig/blob/master/GAMES_LIST.md).
- Ses **requêtes** doivent répondre. C'est le cas par défaut pour la plupart
  des jeux ; certains demandent un réglage :
  - **Valheim** : lancer le serveur en mode public (`-public 1`) ;
  - **Palworld** : `RESTAPIEnabled=True`, et le mot de passe admin dans la
    configuration ;
  - **Terraria** : le mod TShock et un jeton REST ;
  - **Farming Simulator** : le jeton de l'interface web du serveur ;
  - **7 Days to Die**, **Counter-Strike 2**, **Conan Exiles** : ils donnent le
    nombre de joueurs, pas leurs noms.
- Un pare-feu devant le serveur doit laisser passer le port de requête
  (souvent un port UDP voisin du port de jeu : Valheim 2457, ARK 27015…).

## Configuration

1. Installez l'intégration depuis le catalogue de Gladys.
2. Dans **Configuration**, pour chaque serveur (quatre au plus) :
   - choisissez le **Jeu**. Absent de la liste ? Choisissez **Autre (type
     GameDig)** et tapez son identifiant de la liste des jeux de GameDig
     (`barotrauma`, `insurgency`…) dans **Type GameDig** ;
   - saisissez l'**Adresse** : `192.168.1.20`, `game.example.com`, et
     `:port` quand le port n'est pas celui par défaut du jeu. Le port de jeu
     comme le port de requête conviennent : GameDig essaie d'abord le port de
     requête du jeu ;
   - si vous voulez, un **Nom affiché dans Gladys**, et le **Mot de passe ou
     jeton** des quelques jeux qui en demandent un.
3. Choisissez l'**Intervalle de lecture** (1 minute par défaut), et au besoin
   le **Délai d'attente des réponses** et les **Essais par lecture** pour un
   serveur lointain.
4. Enregistrez, puis cliquez sur **Tester la connexion** : une ligne par
   serveur, avec son jeu, ses joueurs, son ping et sa carte.
5. Dans **Découverte**, ajoutez les appareils à garder dans Gladys
   (historique, tableau de bord). Les déclencheurs de scène et le widget
   marchent même sans eux.

## L'appareil de chaque serveur

| Fonctionnalité    | Ce qu'elle indique                                             |
| ----------------- | -------------------------------------------------------------- |
| En ligne          | 1 quand le serveur répond, 0 après deux lectures sans réponse  |
| Joueurs connectés | les personnes qui jouent maintenant (les bots ne comptent pas) |
| Places            | le nombre maximal de joueurs                                   |
| Joueurs           | qui joue, ou combien quand le jeu ne donne pas les noms        |
| Carte             | la carte ou le monde en cours, quand le jeu la donne           |
| Nom du serveur    | le nom annoncé par le serveur, quand le jeu le donne           |
| Version           | la version du serveur de jeu, quand le jeu la donne            |
| Ping              | le temps de la requête, en millisecondes                       |

**Carte**, **Nom du serveur** et **Version** n'apparaissent qu'une fois que le
jeu a donné une valeur : Mumble n'a pas de carte, beaucoup de jeux pas de
version. Un serveur lu pour la première fois hors ligne les reçoit plus tard ;
Gladys propose alors **Mettre à jour** sur l'appareil dans l'onglet
Découverte.

Les noms des fonctionnalités sont écrits dans la **Langue des noms** de la
configuration, à la création de l'appareil.

## Tableau de bord

Le widget **Serveurs de jeu** montre une tuile par serveur (joueurs connectés
et places, en vert quand il répond, en rouge quand il est hors ligne), puis
l'état et la carte de chaque serveur et qui joue. Tous les serveurs par
défaut, ou celui choisi dans les réglages du widget.

## Scènes

### Déclencheurs

- **Un joueur a rejoint le serveur de jeu** : avec le **Pseudo** quand le jeu
  donne les noms de tous les joueurs, sinon avec un pseudo vide. Le filtre
  **Pseudo (vide : n'importe qui)** est comparé à l'identique, majuscules
  comprises.
- **Un joueur a quitté le serveur de jeu** : donne aussi les **Minutes
  jouées** quand on a vu le joueur arriver.
- **Le serveur de jeu est hors ligne** : après deux lectures sans réponse, à
  15 secondes d'intervalle. Pas de départ pour chaque joueur dans ce cas.
- **Le serveur de jeu est de nouveau en ligne** : avec les **Minutes hors
  ligne**.
- **Le serveur de jeu est vide** : le dernier joueur est parti.
- **Le serveur de jeu est plein** : toutes les places sont prises.

Chaque déclencheur peut se limiter à un serveur, et passe aux actions
suivantes le nom du serveur, le jeu et le nombre de joueurs. Un serveur qui
redémarre avec beaucoup de joueurs déclenche dix arrivées au plus.

### Actions

- **Lire un serveur de jeu** : l'interroge maintenant et passe son état aux
  étapes suivantes : En ligne, Joueurs connectés, Places, Joueurs, Carte,
  Version, Ping… Pour un message (« 3 joueurs sur Valheim : Ann, Bob,
  Chris »), ou une condition **Continuer seulement si** sur En ligne.

### Idées de scènes

- **Quelqu'un a rejoint notre serveur** → une notification avec le pseudo et
  le nom du serveur, choisis dans les variables du déclencheur.
- **Le serveur de jeu est hors ligne** → un message Telegram à qui s'en
  occupe, et rallumer la prise du serveur au bout de 5 minutes.
- **Vendredi 21 h** → **Lire un serveur de jeu** → **Continuer seulement si**
  En ligne → un message « déjà N joueurs sur la carte », avec Joueurs
  connectés et Carte.
- **Le serveur de jeu est vide** la nuit → éteindre la prise du PC de jeu.

## Dépannage

- **Ne répond pas (jeu, port, requêtes activées ?)** : le bon jeu ? Le bon
  port (essayez le port de jeu et le port de requête) ? Les requêtes activées
  sur le serveur (Valheim `-public 1`, API REST de Palworld) ? Un pare-feu qui
  laisse passer l'UDP ? Les `docker logs` de l'intégration avec
  `LOG_LEVEL=debug` montrent chaque lecture.
- **Nom introuvable** : le nom de l'adresse ne se résout pas depuis Gladys.
- **Type GameDig inconnu** : l'identifiant tapé dans **Type GameDig** n'est
  pas dans la liste des jeux de GameDig.
- **Joueurs donne un nombre, pas des noms** : le jeu ne les donne pas
  (Counter-Strike 2, 7 Days to Die, DayZ…). Les déclencheurs marchent alors
  au nombre.
- **Joueurs connectés vaut 0 alors que des bots jouent** : les bots ne
  comptent pas, exprès.

## Limites

- Lecture toutes les minutes par défaut (30 secondes au plus vite) : un joueur
  qui reste moins d'un intervalle peut passer inaperçu, et les événements
  arrivent avec une lecture de retard.
- Quatre serveurs au plus. GameDig lit ce que chaque jeu publie : noms, carte
  et version dépendent du jeu, et certains jeux annoncent moins de joueurs
  qu'il n'y en a.
- La requête, ce sont quelques petits paquets par lecture : elle ne charge
  jamais un serveur, et les serveurs publics ne la limitent pas à ce rythme.
- Rien n'est modifié sur les serveurs : l'intégration ne fait que les lire.
- Les secrets saisis dans la configuration ne vont qu'au serveur de jeu
  concerné, et n'apparaissent jamais dans les journaux.

GameDig est © ses contributeurs, licence MIT.
