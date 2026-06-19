// Headless check that the bridge actually streams the protocol over a real WebSocket.
// Requires the bridge to be running. Uses Node's built-in WebSocket client (Node >= 22).
// Usage: node bridge/test/ws-smoke.mjs   (WS env var overrides the URL)
const url = process.env.WS || "ws://localhost:8080/ws";
const seen = {};
let done = false;

const ws = new WebSocket(url);
const timer = setTimeout(finish, 3000); // assert on whatever arrived within 3s

ws.onmessage = (e) => {
  let m;
  try {
    m = JSON.parse(e.data);
  } catch {
    return;
  }
  seen[m.type] = (seen[m.type] || 0) + 1;
  if (seen.hello && seen.map && seen.units) finish();
};
ws.onerror = () => {
  console.error("  FAIL- could not connect to", url, "(is the bridge running?)");
  process.exit(1);
};

function finish() {
  if (done) return;
  done = true;
  clearTimeout(timer);
  try {
    ws.close();
  } catch {}

  let fail = 0;
  const ok = (c, m) => (c ? console.log("  ok  -", m) : (console.error("  FAIL-", m), fail++));
  ok(seen.hello >= 1, "received hello over WebSocket");
  ok(seen.map >= 1, `received ${seen.map || 0} map message(s) over WebSocket`);
  ok(seen.units >= 1, "received units over WebSocket");

  console.log(fail ? `\n${fail} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  process.exit(fail ? 1 : 0);
}
