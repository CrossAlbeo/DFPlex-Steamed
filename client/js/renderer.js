// Renderer: draws the current z-level of the World through a Camera onto a 2D canvas.
// Only the visible tile window is drawn each frame.

import { PALETTE, tiledict, UNIT_DEFAULT } from "./tiledict.js";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.cursor = null; // {x,y} tile under the mouse, or null
  }

  /** Resize the backing store to the displayed size (accounting for devicePixelRatio). */
  resize() {
    const dpr = globalThis.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._w = rect.width;
    this._h = rect.height;
  }

  draw(world, cam) {
    const ctx = this.ctx;
    const cell = cam.cell;
    const W = this._w || this.canvas.width;
    const H = this._h || this.canvas.height;

    ctx.fillStyle = PALETTE[0];
    ctx.fillRect(0, 0, W, H);

    if (!world.map) return;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.floor(cell)}px "Cascadia Mono","Consolas","DejaVu Sans Mono",monospace`;

    const cols = Math.ceil(W / cell) + 1;
    const rows = Math.ceil(H / cell) + 1;
    const tx0 = Math.floor(cam.x);
    const ty0 = Math.floor(cam.y);

    // Tiles
    for (let ry = 0; ry < rows; ry++) {
      const ty = ty0 + ry;
      for (let rx = 0; rx < cols; rx++) {
        const tx = tx0 + rx;
        const code = world.tileAt(tx, ty, cam.z);
        const t = tiledict[code];
        const sx = (tx - cam.x) * cell;
        const sy = (ty - cam.y) * cell;
        if (t.bg) {
          ctx.fillStyle = PALETTE[t.bg];
          ctx.fillRect(sx, sy, cell + 1, cell + 1);
        }
        if (t.ch !== " ") {
          ctx.fillStyle = PALETTE[t.fg];
          ctx.fillText(t.ch, sx + cell / 2, sy + cell / 2 + 1);
        }
      }
    }

    // Units on this z-level
    for (const u of world.unitsOnZ(cam.z)) {
      const sx = (u.x - cam.x) * cell;
      const sy = (u.y - cam.y) * cell;
      if (sx < -cell || sy < -cell || sx > W || sy > H) continue;
      ctx.fillStyle = PALETTE[u.color ?? UNIT_DEFAULT.color];
      ctx.fillText(u.ch || UNIT_DEFAULT.ch, sx + cell / 2, sy + cell / 2 + 1);
    }

    // Mouse cursor highlight
    if (this.cursor) {
      const sx = (this.cursor.x - cam.x) * cell;
      const sy = (this.cursor.y - cam.y) * cell;
      ctx.strokeStyle = PALETTE[15];
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, sy + 0.5, cell - 1, cell - 1);
    }
  }
}
