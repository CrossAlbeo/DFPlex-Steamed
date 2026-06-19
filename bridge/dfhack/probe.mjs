// Connectivity probe: connect to DFHack remote and complete the handshake only.
// No protobuf yet — this just proves the transport against a running DF.
// Usage: node bridge/dfhack/probe.mjs   (DF_HOST / DF_PORT override host:port)
import { DFHackConnection } from "./connection.mjs";

const host = process.env.DF_HOST || "127.0.0.1";
const port = Number(process.env.DF_PORT) || 5000;

try {
  const conn = await DFHackConnection.connect({ host, port });
  console.log(`  ok  - handshake OK with DFHack at ${host}:${port} (server RPC version ${conn.serverVersion})`);
  conn.quit();
  console.log("\nALL CHECKS PASSED");
  process.exit(0);
} catch (e) {
  console.error(`  FAIL- ${e.message}`);
  console.error("        Is DF running with DFHack remote enabled (RemoteFortressReader on, port 5000)?");
  process.exit(1);
}
