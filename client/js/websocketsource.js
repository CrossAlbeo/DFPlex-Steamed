// WebSocketSource: a live feed over WebSocket. Used to talk to the RFR bridge (feature 2)
// and later the dfplex plugin. Browser-only (uses the WebSocket global). The message shapes
// are exactly the protocol the MockSource already produces, so the app code is unchanged.

import { DataSource } from "./datasource.js";
import { C2S } from "./protocol.js";

export class WebSocketSource extends DataSource {
  constructor(url, nick = "Web") {
    super();
    this.url = url;
    this.nick = nick;
    this.ws = null;
  }

  start() {
    super.start();
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => this.send({ type: C2S.JOIN, nick: this.nick });
    this.ws.onmessage = (e) => {
      try {
        this._emit(JSON.parse(e.data));
      } catch {
        // ignore malformed frames
      }
    };
    this.ws.onclose = () => this._emit({ type: "error", message: "connection closed" });
    this.ws.onerror = () => this._emit({ type: "error", message: "connection error" });
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  stop() {
    super.stop();
    if (this.ws) {
      this.ws.onclose = null; // avoid emitting a spurious error on intentional stop
      this.ws.close();
      this.ws = null;
    }
  }
}
