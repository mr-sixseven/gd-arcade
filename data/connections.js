/* GD Arcade — curated Connections groups.
 * Every group contains four levels from data/levels.js. Groups are kept
 * level-disjoint and carry explicit compatibility rules so a generated board
 * never contains a level that could reasonably fit another visible category.
 */
window.GD_CONNECTIONS_GROUPS = [
  {
    id: "at-the-speed-of-light",
    label: "Uses the song “At the Speed of Light”",
    short: "At the Speed of Light",
    tier: 1,
    levels: ["aftermath", "Bloodbath", "Bloodlust", "Cataclysm"],
    excludes: ["lowercase-titles", "three-coins"]
  },
  {
    id: "clubstep-song",
    label: "Uses the song “Clubstep”",
    short: "Clubstep",
    tier: 1,
    levels: ["ICE Carbon Diablo X", "Red World", "Silent clubstep", "Tartarus"],
    excludes: ["color-names", "s-names"]
  },
  {
    id: "viprin",
    label: "Created by ViPriN",
    short: "ViPriN",
    tier: 1,
    levels: ["Artificial Ascent", "Digital Descent", "Golden Haze", "HyperSonic"],
    excludes: ["color-names"]
  },
  {
    id: "cherryteam",
    label: "Created by cherryteam",
    short: "cherryteam",
    tier: 1,
    levels: ["cytokinesis", "Green Bullet", "KOCMOC", "Penumbral"],
    excludes: ["lowercase-titles", "color-names"]
  },
  {
    id: "weather",
    label: "Weather and sky imagery",
    short: "Weather & sky",
    tier: 2,
    levels: ["Windy Landscape", "Tidal Wave", "Sunset Sandstorm", "Antarctic Lights"],
    excludes: ["s-names", "three-coins"]
  },
  {
    id: "fire",
    label: "Fire and brimstone imagery",
    short: "Fire & brimstone",
    tier: 2,
    levels: ["Flamewall", "Firework", "Infernal Arena", "The Hell Zone"],
    excludes: ["three-coins"]
  },
  {
    id: "space",
    label: "Space and cosmic imagery",
    short: "Space & cosmos",
    tier: 2,
    levels: ["OuterSpace", "ORBIT", "Nullscapes", "Plasma Pulse Finale"],
    excludes: ["three-coins"]
  },
  {
    id: "lowercase-titles",
    label: "Titles written entirely in lowercase",
    short: "lowercase titles",
    tier: 3,
    levels: ["demon park", "flappy hexagon", "fractured circles", "lucid dream"],
    excludes: ["at-the-speed-of-light", "cherryteam"]
  },
  {
    id: "numbered-titles",
    label: "Titles containing a number",
    short: "numbered titles",
    tier: 3,
    levels: ["Artemis 13", "BuTiTi III", "Photovoltaic II", "Thinking Space II"],
    excludes: ["three-coins"]
  },
  {
    id: "color-names",
    label: "A colour appears in the title",
    short: "colour names",
    tier: 3,
    levels: ["Black Blizzard", "Red World", "Green Bullet", "Golden Haze"],
    excludes: ["clubstep-song", "viprin", "cherryteam"]
  },
  {
    id: "s-names",
    label: "Titles beginning with the letter S",
    short: "names starting with S",
    tier: 3,
    levels: ["Society", "Sonar", "SLAM", "Sunshine"],
    excludes: ["clubstep-song", "weather", "three-coins"]
  },
  {
    id: "three-coins",
    label: "Award three user coins",
    short: "three coins",
    tier: 4,
    levels: ["Adrift", "Aeternus", "Amplification", "Aquamarine"],
    excludes: ["at-the-speed-of-light", "weather", "fire", "space", "numbered-titles", "s-names"]
  }
];
