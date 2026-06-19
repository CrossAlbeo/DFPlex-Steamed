// One-shot exploration against live DF to pin down RFR coordinate semantics before
// building the real data source. Dumps tiletype table stats, the view's z-level, one
// z-slice of blocks (counts, coord spread, shape histogram, water/magma), and units.
// Usage: node bridge/dfhack/explore.mjs
import { DFHackClient } from "./client.mjs";

const client = await DFHackClient.connect({
  host: process.env.DF_HOST || "127.0.0.1",
  port: Number(process.env.DF_PORT) || 5000,
});

// Tiletype table: id -> { shape, material }
const tl = await client.call("GetTiletypeList");
const tts = tl.tiletype_list || [];
const byId = new Map(tts.map((t) => [t.id, t]));
const maxId = Math.max(...tts.map((t) => t.id));
console.log(`tiletypes: ${tts.length} entries, max id ${maxId}`);
for (const id of [0, 1, 32, 256]) {
  const t = byId.get(id);
  if (t) console.log(`  id ${id}: shape=${t.shape} material=${t.material} name="${t.name}"`);
}

const view = await client.call("GetViewInfo");
console.log(`view: pos=(${view.view_pos_x},${view.view_pos_y},${view.view_pos_z}) size=(${view.view_size_x},${view.view_size_y})`);

const info = await client.call("GetMapInfo");
const z = view.view_pos_z || Math.floor(info.block_size_z / 2);

// One z-slice over the full x/y block range.
const req = {
  blocks_needed: info.block_size_x * info.block_size_y + 8,
  min_x: 0, max_x: info.block_size_x,
  min_y: 0, max_y: info.block_size_y,
  min_z: z, max_z: z + 1,
  force_reload: true,
};
const bl = await client.call("GetBlockList", req);
const blocks = bl.map_blocks || [];
console.log(`\nGetBlockList @ z=${z}: ${blocks.length} blocks (requested blocks_needed=${req.blocks_needed})`);
if (blocks[0]) {
  const b = blocks[0];
  console.log(`  block[0]: map_x=${b.map_x} map_y=${b.map_y} map_z=${b.map_z} tiles.length=${(b.tiles || []).length}`);
}
const xs = [...new Set(blocks.map((b) => b.map_x))].sort((a, b) => a - b);
const ys = [...new Set(blocks.map((b) => b.map_y))].sort((a, b) => a - b);
console.log(`  distinct map_x (${xs.length}):`, xs.slice(0, 10), xs.length > 10 ? "..." : "");
console.log(`  distinct map_y (${ys.length}):`, ys.slice(0, 10), ys.length > 10 ? "..." : "");

const hist = {};
let tileCount = 0, water = 0, magma = 0, hidden = 0;
for (const b of blocks) {
  const tiles = b.tiles || [];
  tileCount += tiles.length;
  for (const id of tiles) {
    const t = byId.get(id);
    const s = t ? t.shape : "UNK";
    hist[s] = (hist[s] || 0) + 1;
  }
  for (const w of b.water || []) if (w > 0) water++;
  for (const m of b.magma || []) if (m > 0) magma++;
  for (const h of b.hidden || []) if (h) hidden++;
}
console.log(`  tiles=${tileCount} water=${water} magma=${magma} hidden=${hidden}`);
console.log(`  shape histogram (TiletypeShape enum #):`, JSON.stringify(hist));

const ul = await client.call("GetUnitList");
const us = ul.creature_list || [];
console.log(`\nunits: ${us.length}`);
for (const u of us.slice(0, 5)) {
  console.log(`  unit ${u.id}: pos=(${u.pos_x},${u.pos_y},${u.pos_z}) race=${u.race && u.race.mat_type}/${u.race && u.race.mat_index} flags1=0x${(u.flags1 >>> 0).toString(16)} name="${u.name || ""}"`);
}

client.quit();
console.log("\ndone.");
