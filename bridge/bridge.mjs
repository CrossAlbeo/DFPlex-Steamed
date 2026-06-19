// dfplex dev bridge.
//
// Serves the web client (static files) AND a WebSocket endpoint at /ws on one port, so the
// browser can connect same-origin. Right now each WebSocket connection is fed by a MockSource,
// which streams the same protocol the client already renders. The next step replaces the mock
// data source with live RemoteFortressReader reads from a running DF (the WebSocket-serving
// half here stays the same).
//
// Usage: node bridge/bridge.mjs   (then open http://localhost:8080, choose "WebSocket")
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { MockSource } from "../client/js/mock.js";
import { C2S } from "../client/js/protocol.js";

const CLIENT_ROOT = resolve(fileURLToPath(new URL("../client/", import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const SEP = process.platform === "win32" ? "\\" : "/";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

// --- static file serving (mirrors client/serve.mjs, rooted at the client dir) ---
const httpServer = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const filePath = normalize(join(CLIENT_ROOT, pathname));
    if (filePath !== CLIENT_ROOT && !filePath.startsWith(CLIENT_ROOT + SEP)) {
      res.writeHead(403);
      return res.end("forbidden");
    }
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

// --- WebSocket endpoint at /ws ---
const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (pathname === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws) => {
  // One independent data source per client — exactly the multiplayer model.
  const source = new MockSource({ tickMs: 120 });
  const unsub = source.onMessage((msg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  });

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    // join/viewport are accepted now (no-ops for the mock); command handling lands with RFR.
    if (msg.type === C2S.JOIN && typeof msg.nick === "string") {
      source.nick = msg.nick;
    }
  });

  ws.on("close", () => {
    source.stop();
    unsub();
  });

  source.start();
});

httpServer.listen(PORT, () => {
  console.log(`dfplex bridge (mock data): http://localhost:${PORT}  ·  ws://localhost:${PORT}/ws`);
});
