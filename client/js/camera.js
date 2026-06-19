// Camera: this client's private view into the fortress — pan offset (in tiles), zoom, and
// current z-level. Entirely client-side, which is exactly why independent per-player views
// are free in this architecture: every browser has its own Camera over the shared world.

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export class Camera {
  constructor() {
    this.x = 0; // tile coordinate at the left edge of the viewport (float)
    this.y = 0; // tile coordinate at the top edge of the viewport (float)
    this.z = 0;
    this.tileSize = 16; // base pixels per tile
    this.zoom = 1.5;
    this.minZoom = 0.5;
    this.maxZoom = 4;
  }

  /** Pixels per tile at the current zoom. */
  get cell() {
    return this.tileSize * this.zoom;
  }

  /** Screen pixel -> tile coordinate (floored to a tile). */
  screenToTile(sx, sy) {
    return { x: Math.floor(this.x + sx / this.cell), y: Math.floor(this.y + sy / this.cell) };
  }

  /** Tile coordinate -> screen pixel (top-left of the tile). */
  tileToScreen(tx, ty) {
    return { x: (tx - this.x) * this.cell, y: (ty - this.y) * this.cell };
  }

  /** Pan by a screen-pixel delta (e.g. mouse drag). */
  panByPixels(dx, dy) {
    this.x -= dx / this.cell;
    this.y -= dy / this.cell;
  }

  /** Pan by whole tiles (e.g. arrow keys). */
  panByTiles(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  /** Zoom by a factor while keeping the tile under (sx,sy) fixed on screen. */
  zoomAt(factor, sx, sy) {
    const txBefore = this.x + sx / this.cell;
    const tyBefore = this.y + sy / this.cell;
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    this.x = txBefore - sx / this.cell;
    this.y = tyBefore - sy / this.cell;
  }

  /** Change z-level, clamped to [0, zCount-1]. */
  changeZ(dz, zCount) {
    this.z = clamp(this.z + dz, 0, Math.max(0, zCount - 1));
  }

  /** Center the viewport on a tile, given the viewport size in pixels. */
  centerOn(tx, ty, viewW, viewH) {
    this.x = tx - viewW / this.cell / 2;
    this.y = ty - viewH / this.cell / 2;
  }
}
