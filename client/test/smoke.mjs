// Headless sanity check for the data layer: drive MockSource into World and assert the
// protocol/world plumbing holds. Runs under Node (no DOM). Usage: node client/test/smoke.mjs
import { MockSource } from "../js/mock.js";
import { World } from "../js/world.js";
import { isTile } from "../js/protocol.js";

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log("  ok  -", msg);
  } else {
    console.error("  FAIL-", msg);
    failures++;
  }
}

const world = new World();
const seen = {};
// Large tickMs so the internal timer never fires during the test; we step() manually.
const src = new MockSource({ tickMs: 1_000_000 });
src.onMessage((m) => {
  seen[m.type] = (seen[m.type] || 0) + 1;
  world.apply(m);
});

src.start();

assert(seen.hello === 1, "received exactly one hello");
assert(!!world.map && world.map.xCount === 48 && world.map.yCount === 48, "map dimensions applied");
assert(seen.map === world.map.zCount, `one map per z-level (${world.map.zCount})`);
assert(world.units.size > 0, "at least one unit present");

let allValid = true;
for (let z = 0; z < world.map.zCount; z++) {
  const lvl = world.levels.get(z);
  if (!lvl) {
    allValid = false;
    break;
  }
  for (const c of lvl.tiles) if (!isTile(c)) { allValid = false; break; }
}
assert(allValid, "every stored tile is a valid shape code");

const before = [...world.units.values()].map((u) => ({ ...u }));
for (let i = 0; i < 20; i++) src.step();

let inBounds = true;
for (const u of world.units.values()) {
  if (u.x < 0 || u.y < 0 || u.x >= world.map.xCount || u.y >= world.map.yCount) inBounds = false;
}
const after = [...world.units.values()];
const moved = after.some((u, i) => u.x !== before[i].x || u.y !== before[i].y);

assert(inBounds, "units stay in bounds after 20 ticks");
assert(world.frame === 20, "frame counter advanced to 20");
assert(moved, "at least one unit moved");

src.stop();
console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
