// Zero-dependency static dev server for the dfplex client. Node only.
// Usage: node client/serve.mjs   (then open http://localhost:8080)
// PORT env var overrides the default port.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("./", import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;

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

const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const filePath = normalize(join(ROOT, pathname));
    // prevent path traversal outside the client root
    if (filePath !== ROOT && !filePath.startsWith(ROOT + (process.platform === "win32" ? "\\" : "/"))) {
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

server.listen(PORT, () => {
  console.log(`dfplex client dev server: http://localhost:${PORT}`);
});
