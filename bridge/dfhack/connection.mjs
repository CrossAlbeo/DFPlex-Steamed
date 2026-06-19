// Low-level DFHack remote-protocol transport (TCP, port 5000).
//
// This speaks the raw DFHack RPC wire format — nothing protobuf-aware lives here:
//   - handshake: send "DFHack?\n" + int32 version, expect "DFHack!\n" + int32 version
//   - framing:   each message is an 8-byte header (int16 id, 2 pad, int32 size) + body bytes
//
// The protobuf layer (bind a method, encode/decode messages, handle TEXT/FAIL replies)
// sits on top in client.mjs. Reference: DFHack library/RemoteClient.cpp.
import net from "node:net";

export const MAGIC_Q = "DFHack?\n"; // 8 bytes
export const MAGIC_R = "DFHack!\n"; // 8 bytes
export const RPC_VERSION = 1;

// Reserved RPC function ids (negative ids are replies, see RemoteClient.h).
export const RPC = Object.freeze({
  REPLY_RESULT: -1,
  REPLY_FAIL: -2,
  REPLY_TEXT: -3,
  REQUEST_QUIT: -4,
  BIND_METHOD: 0,
  RUN_COMMAND: 1,
});

// Pull-based reader: turns the socket's push 'data' events into `await read(n)`.
class ByteReader {
  constructor(socket) {
    this.buf = Buffer.alloc(0);
    this.waiters = []; // { n, resolve, reject }
    this.error = null;
    socket.on("data", (d) => {
      this.buf = Buffer.concat([this.buf, d]);
      this._pump();
    });
    socket.on("close", () => this._fail(new Error("socket closed")));
    socket.on("error", (e) => this._fail(e));
  }

  read(n) {
    if (this.error) return Promise.reject(this.error);
    return new Promise((resolve, reject) => {
      this.waiters.push({ n, resolve, reject });
      this._pump();
    });
  }

  _pump() {
    while (this.waiters.length && this.buf.length >= this.waiters[0].n) {
      const { n, resolve } = this.waiters.shift();
      resolve(Buffer.from(this.buf.subarray(0, n))); // copy: detach from the rolling buffer
      this.buf = this.buf.subarray(n);
    }
  }

  _fail(err) {
    if (this.error) return;
    this.error = err;
    const pending = this.waiters;
    this.waiters = [];
    for (const w of pending) w.reject(err);
  }
}

export class DFHackConnection {
  constructor(socket) {
    this.socket = socket;
    this.reader = new ByteReader(socket);
    this.serverVersion = null;
  }

  static connect({ host = "127.0.0.1", port = 5000, timeoutMs = 4000 } = {}) {
    return new Promise((resolve, reject) => {
      const socket = net.connect({ host, port });
      const onErr = (e) => {
        cleanup();
        reject(e);
      };
      const to = setTimeout(() => {
        cleanup();
        socket.destroy();
        reject(new Error(`connect timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      function cleanup() {
        clearTimeout(to);
        socket.removeListener("error", onErr);
      }
      socket.once("error", onErr);
      socket.once("connect", async () => {
        const conn = new DFHackConnection(socket);
        try {
          await conn._handshake();
          cleanup();
          resolve(conn);
        } catch (e) {
          cleanup();
          socket.destroy();
          reject(e);
        }
      });
    });
  }

  async _handshake() {
    const req = Buffer.alloc(12);
    req.write(MAGIC_Q, 0, "ascii");
    req.writeInt32LE(RPC_VERSION, 8);
    this.socket.write(req);

    const reply = await this.reader.read(12);
    const magic = reply.toString("ascii", 0, 8);
    if (magic !== MAGIC_R) throw new Error(`bad handshake magic: ${JSON.stringify(magic)}`);
    this.serverVersion = reply.readInt32LE(8);
    return this.serverVersion;
  }

  // Send one framed RPC message: header (id + size) then body.
  sendMessage(id, body = Buffer.alloc(0)) {
    const header = Buffer.alloc(8);
    header.writeInt16LE(id, 0); // bytes 2-3 stay zero (alignment padding)
    header.writeInt32LE(body.length, 4);
    this.socket.write(header);
    if (body.length) this.socket.write(Buffer.from(body));
  }

  // Receive a frame header: { id, size }. For REPLY_FAIL, `size` is the error
  // code, NOT a body length, so callers must decide whether to read a body.
  async recvHeader() {
    const header = await this.reader.read(8);
    return { id: header.readInt16LE(0), size: header.readInt32LE(4) };
  }

  async readBody(size) {
    return size > 0 ? await this.reader.read(size) : Buffer.alloc(0);
  }

  quit() {
    try {
      this.sendMessage(RPC.REQUEST_QUIT);
    } catch {
      /* socket may already be gone */
    }
    try {
      this.socket.end();
    } catch {
      /* ignore */
    }
  }
}
