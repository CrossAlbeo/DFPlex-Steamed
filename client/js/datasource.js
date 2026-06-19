// DataSource: an abstract stream of protocol messages (see ../../docs/protocol.md).
// The app subscribes with onMessage() and pushes client->server messages with send().
// Concrete sources: MockSource (in-browser fake), WebSocketSource (live bridge/plugin).
// No DOM usage here, so sources can be exercised under Node for headless tests.

export class DataSource {
  constructor() {
    this._handlers = new Set();
    this._running = false;
  }

  /** Register a handler for server->client messages. Returns an unsubscribe fn. */
  onMessage(cb) {
    this._handlers.add(cb);
    return () => this._handlers.delete(cb);
  }

  /** Deliver a server->client message to all subscribers. */
  _emit(msg) {
    for (const h of this._handlers) h(msg);
  }

  /** Send a client->server message. Override in concrete sources. */
  send(_msg) {}

  /** Begin producing messages. Override and call super.start(). */
  start() {
    this._running = true;
  }

  /** Stop producing messages. Override and call super.stop(). */
  stop() {
    this._running = false;
  }

  get running() {
    return this._running;
  }
}
