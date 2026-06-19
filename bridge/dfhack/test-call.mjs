// Proves the protobuf layer: connect, bind, and call simple RFR methods against live DF.
// Usage: node bridge/dfhack/test-call.mjs   (needs DF running with a fortress loaded)
import { DFHackClient } from "./client.mjs";

const host = process.env.DF_HOST || "127.0.0.1";
const port = Number(process.env.DF_PORT) || 5000;

let fail = 0;
const ok = (c, m) => (c ? console.log("  ok  -", m) : (console.error("  FAIL-", m), fail++));

const client = await DFHackClient.connect({ host, port }).catch((e) => {
  console.error("  FAIL- connect:", e.message);
  process.exit(1);
});
console.log(`  ok  - connected (RPC version ${client.conn.serverVersion})`);

try {
  const ver = await client.call("GetVersionInfo");
  ok(true, `GetVersionInfo -> DF ${ver.dwarf_fortress_version || "?"}, DFHack ${ver.dwarf_fortress_version ? "" : ""}${ver.dfhack_version || "?"}`);

  const info = await client.call("GetMapInfo");
  const loaded = info.block_size_x > 0 && info.block_size_y > 0;
  ok(loaded, `GetMapInfo -> world="${info.world_name_english || info.world_name || ""}" save="${info.save_name || ""}" blocks=${info.block_size_x}x${info.block_size_y}x${info.block_size_z} (=${info.block_size_x * 16}x${info.block_size_y * 16} tiles)`);
  if (!loaded) console.error("        (no fortress loaded? load a fort in DF, then re-run)");
} catch (e) {
  ok(false, `call threw: ${e.message}`);
} finally {
  client.quit();
}

console.log(fail ? `\n${fail} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fail ? 1 : 0);
