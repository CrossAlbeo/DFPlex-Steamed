# dfplex bridge

A small Node service that sits between the web client and Dwarf Fortress. It serves the client
(static files) and a WebSocket endpoint at `/ws` on one port, translating fortress state into the
[dfplex protocol](../docs/protocol.md).

**Status:** the WebSocket transport is in place, currently fed by the in-browser `MockSource`'s
server-side twin. The next step swaps that for live reads from DFHack's **RemoteFortressReader**
(TCP `127.0.0.1:5000`), so the client renders a real running fortress.

## Run

```bash
cd bridge
npm install        # once, installs ws
npm start          # serves http://localhost:8080 and ws://localhost:8080/ws
```

Open <http://localhost:8080>, choose **WebSocket** as the source, and Connect. You should see the
same fortress as the Mock source, but delivered over the wire.

## Test

```bash
npm start          # in one terminal
npm test           # in another — asserts hello/map/units arrive over the WebSocket
```
