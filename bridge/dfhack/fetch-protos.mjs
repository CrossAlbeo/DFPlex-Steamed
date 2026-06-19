// Vendoring helper: download the DFHack .proto files we need into ./protos/.
// DFHack ships compiled plugins, not the .proto sources, so we fetch them from GitHub.
// Recursively follows `import` statements so protobufjs can resolve everything locally.
// Re-run to refresh. Node >= 18 (global fetch).
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "protos");
const REF = process.env.DFHACK_REF || "53.14-r2"; // matches the user's DFHack version

// Directories in the DFHack repo a proto filename might live in.
const DIRS = ["library/proto", "plugins/remotefortressreader/proto", "plugins/proto"];

const SEEDS = ["CoreProtocol.proto", "RemoteFortressReader.proto"];

async function fetchProto(name) {
  for (const dir of DIRS) {
    const url = `https://raw.githubusercontent.com/DFHack/dfhack/${REF}/${dir}/${name}`;
    const res = await fetch(url).catch(() => null);
    if (res && res.ok) return { text: await res.text(), where: `${dir}/${name}` };
  }
  return null;
}

await mkdir(OUT, { recursive: true });

const seen = new Set();
const queue = [...SEEDS];
let failed = false;

while (queue.length) {
  const name = queue.shift();
  if (seen.has(name)) continue;
  seen.add(name);

  const got = await fetchProto(name);
  if (!got) {
    console.error(`  FAIL- could not fetch ${name}`);
    failed = true;
    continue;
  }
  await writeFile(join(OUT, name), got.text);
  console.log(`  ok  - ${name}  <-  ${REF}/${got.where}  (${got.text.length} bytes)`);

  for (const m of got.text.matchAll(/^\s*import\s+"([^"]+)"\s*;/gm)) {
    const dep = m[1].split("/").pop(); // flatten to bare filename
    if (!seen.has(dep)) queue.push(dep);
  }
}

console.log(failed ? "\nSOME FILES MISSING" : `\nALL PROTOS VENDORED (${seen.size} files)`);
process.exit(failed ? 1 : 0);
