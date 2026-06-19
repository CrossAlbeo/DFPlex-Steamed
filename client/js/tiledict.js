// Visual mapping owned by the client: TILE shape code -> glyph + palette colors.
// Data sources emit shape codes only; this file decides how they look, so the renderer
// stays independent of DF internals and the look can be tuned in one place.

import { TILE, TILE_COUNT } from "./protocol.js";

/** DF-style 16-colour palette (CGA-ish). Index 0 doubles as the canvas background. */
export const PALETTE = [
  "#0b0b0b", // 0 black
  "#2233aa", // 1 blue
  "#2c9b2c", // 2 green
  "#2aa7a7", // 3 cyan
  "#a83232", // 4 red
  "#9b2c9b", // 5 magenta
  "#a8762a", // 6 brown
  "#aaaaaa", // 7 light gray
  "#555555", // 8 dark gray
  "#5566ff", // 9 light blue
  "#5cd65c", // 10 light green
  "#5cd6d6", // 11 light cyan
  "#ff5c5c", // 12 light red
  "#ff5cff", // 13 light magenta
  "#ffe34d", // 14 yellow
  "#ffffff", // 15 white
];

/** Default unit appearance when a unit omits its own ch/color. */
export const UNIT_DEFAULT = Object.freeze({ ch: "☺", color: 14 }); // ☺, yellow

// spec: { ch, fg (palette idx), bg (palette idx) }. bg 0 == canvas background.
const spec = {};
spec[TILE.EMPTY] = { ch: " ", fg: 8, bg: 0 };
spec[TILE.FLOOR] = { ch: ".", fg: 8, bg: 0 };
spec[TILE.WALL] = { ch: " ", fg: 7, bg: 8 }; // solid block reads clearly as rock
spec[TILE.RAMP_UP] = { ch: "▲", fg: 6, bg: 0 }; // ▲
spec[TILE.RAMP_DOWN] = { ch: "▼", fg: 6, bg: 0 }; // ▼
spec[TILE.STAIR_UP] = { ch: "<", fg: 15, bg: 0 };
spec[TILE.STAIR_DOWN] = { ch: ">", fg: 15, bg: 0 };
spec[TILE.STAIR_UPDOWN] = { ch: "X", fg: 15, bg: 0 };
spec[TILE.WATER] = { ch: "≈", fg: 11, bg: 1 }; // ≈ on blue
spec[TILE.MAGMA] = { ch: "≈", fg: 14, bg: 4 }; // ≈ on red
spec[TILE.TREE] = { ch: "♣", fg: 2, bg: 0 }; // ♣
spec[TILE.SHRUB] = { ch: "*", fg: 10, bg: 0 };
spec[TILE.BOULDER] = { ch: "o", fg: 7, bg: 0 };
spec[TILE.GRASS] = { ch: ",", fg: 2, bg: 0 };

/** Array indexed by shape code; unknown codes fall back to EMPTY. */
export const tiledict = [];
for (let i = 0; i < TILE_COUNT; i++) tiledict[i] = spec[i] || spec[TILE.EMPTY];
