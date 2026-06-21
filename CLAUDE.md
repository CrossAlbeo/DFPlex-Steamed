# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DFPlex** is a [DFHack](https://github.com/DFHack/dfhack) plugin (C++) that adds simultaneous, real-time co-op multiplayer to **Dwarf Fortress** Fortress mode. Each connected player gets their own independent view, cursor, menus, and UI state — nobody fights for control. Players join from a web browser; no native client. It is a fork of [Webfort](https://github.com/Ankoku/df-webfort), and much Webfort-era code, copyright, and naming (`WF_`, "webfort") still survives in the tree.

The repo has two halves:
- `server/` — the C++ DFHack plugin (the engine; builds to `dfplex.plug`).
- `static/` — the browser client (HTML/JS/CSS) served to players.

Target platform is whatever DFHack targets: **DF/DFHack 0.47.04** (see `Dockerfile`). DF is single-player at heart, so this plugin works by puppeting one DF instance to serve many viewers (see Architecture).

## Active work: the DF 53.x port (read this first)

The plugin described below targets **DF/DFHack 0.47.04**. Active development has moved on: we are **porting to DF 53.x** with a different architecture — a **headless state mirror** rather than an in-process C++ plugin. Read the live fortress over DFHack **RemoteFortressReader (RFR)**, stream it to browsers over WebSocket, and render client-side. Three trees matter:

- **`bridge/`** — a Node dev server (`bridge.mjs`) that reads the live fortress over RFR at `127.0.0.1:5000` and streams it to browsers over **WebSocket**, serving the client on **http://localhost:8080**. No C++ toolchain is involved.
- **`client/`** — the new browser client for the port (canvas renderer; protocol in `client/js/protocol.js`). The legacy Webfort-era client in **`static/`** belongs to the 0.47 plugin and is *not* used by the port.
- **`server/`** — the legacy C++ plugin (the entire Architecture section below). Kept for reference; not part of the bridge port.

For day-to-day work on the port — starting/restarting the bridge, the offline vs live **test tiers**, the probe→backend→test→client **slice pattern**, the **not-sandboxed safety invariants** (only known `kind` keys and integer-coerced coords ever reach generated Lua), and the **feature-branch git flow** — follow the **`/dfplex-bridge`** skill (`.claude/skills/dfplex-bridge/SKILL.md`).

## Building & Running

There is **no standalone build**. DFPlex compiles only as an in-tree DFHack plugin, the same way stonesense does. The repository is meant to live at `dfhack/plugins/dfplex`.

1. Clone DFHack from the **same GitHub namespace** you got this repo from, recursively (DFPlex itself has submodules — see below):
   ```
   git clone --recursive https://github.com/white-rabbit-dfplex/dfhack
   ```
   Then follow the [DFHack build instructions](https://dfhack.readthedocs.io/en/stable/docs/Compile.html). The plugin is wired in via `DFHACK_PLUGIN(dfplex ...)` in `server/CMakeLists.txt`; DFHack's CMake picks it up automatically.

2. **Linux shortcut:** from the dfhack checkout, `devel/df-assemble.sh` downloads the matching DF, builds & installs DFHack into a local `df/`, symlinks the save dir, and tweaks init files. Then `devel/df-launch.sh` runs it (sets `DFPLEX_STATICPORT`/`DFPLEX_STATICDIR` and launches `./dfhack`).

3. **Enable** by putting `enable dfplex` in `dfhack.init` (see `devel/dfhack.init`). DFPlex is incompatible with many other plugins, so keep that file minimal.

4. **Connect** a browser to the static-site port, default `http://localhost:8000/dfplex.html`.

Notes / gotchas:
- **Submodules** (`.gitmodules`): `server/websocketpp`, `server/cpp-httplib`, `server/IXWebSocket`. A non-recursive clone will fail to build.
- **Out-of-tree builds are Linux-only**; on Windows the build must happen inside the DFHack tree (`CMakeLists.txt` hard-errors otherwise).
- **No test suite.** This is a DFHack plugin; verification is manual (launch DF, connect browsers, exercise menus).

## Architecture

### The core multiplayer trick (read `OVERVIEW.md` first)

DF has one global UI. DFPlex fakes per-player independence by, **every frame, for each player** (`dfplex.cpp:dfplex_update()`), rapidly swapping the whole game into that player's UI state, reading their screen, then moving on:

1. **Restore** the player's UI state (`state.cpp:restore_state()`) two ways, often combined:
   - Replaying a saved sequence of interface keys (e.g. `D_NOBLES`, `STANDARDSCROLL_DOWN`…) to re-open their menu — `state.cpp:apply_restore_key()`.
   - Directly poking DF memory (cursor/view position, etc.) — `restore_cursor()`, `restore_data()`, `restore_post_state()`.
2. **Apply** the player's new keypresses this frame (`command.cpp:apply_command()`). If a key changes the current menu (`hackutil.cpp:get_current_menu_id()`), it's appended to that player's restore sequence; backing out of a menu pops keys instead.
3. **Render & store** that player's screen (`screenbuf.cpp:perform_render()`).
4. **Transfer** the screen to the client (`screenbuf.cpp:transfer_screenbuf_client()`) — only CURSES character data, delta-encoded, never pixels, to save bandwidth.
5. **Return to root** (`hackutil.cpp:return_to_root()`) so the next player starts clean.
6. Once all players are processed, set the pause state and let DF advance exactly one real frame.

`command.cpp:apply_special_case()` is the large, important exception table: many menu/key combinations don't fit the general replay logic and are hand-coded there. Expect to touch it whenever a specific menu misbehaves in multiplayer.

### Per-client state (`Client.hpp`)

Each `Client` owns: its own `screenbuf_t sc` (a 256×256 `ClientTile` grid), a `keyqueue` of pending input, and a large `UIState ui` that captures *everything* needed to reconstruct that player's view — the `m_restore_keys` sequence, cursor/view/designation/burrow/squad/stockpile coords and modes, list-scroll positions, chat state, and more. Understanding `UIState` is essential before changing restore/command logic. Clients are created/looked-up via the `add_client`/`get_client`/`remove_client` helpers declared in `dfplex.hpp`.

### Two servers, one plugin (`server.cpp`, `staticserver.cpp`)

- **WebSocket server** on `PORT` (default 1234) carries game I/O. There are **two compile-time backends**, selected by the `DFPLEX_IXW` CMake option:
  - `websocketpp` (default, `OFF`) — requires Boost.
  - `IXWebSocket` (`ON`) — `add_subdirectory(IXWebSocket)`, no Boost.
  `server.cpp` is split into two `#ifdef`'d implementations (`DFPLEX_IXW` vs `DFPLEX_WEBSOCKETPP`) sharing the same `on_open`/`on_message`/`on_close` flow. Recent history disabled IXW on Windows, so **Windows builds use websocketpp + Boost**.
- **Static HTTP server** on `STATICPORT` (default 8000) uses `cpp-httplib` to serve `static/`. It also synthesizes `/config-srv.js`, injecting the live websocket `PORT` into the client at request time.

### Threading

The DF main thread (`plugin_onupdate` → `dfplex_update`) and the websocket server thread share the client list. **`dfplex_mutex` (tinythread) must be held before touching shared client state** — the helper declarations in `dfplex.hpp` say so explicitly. `global_pause`/`is_paused()` coordinate whether DF is allowed to tick.

### Plugin lifecycle (`dfplex.cpp`)

Standard DFHack exports: `plugin_init` (loads `dfplex.txt` config, bans, keybindings, and `RegisterData`s the mutex/chatlog/client-factory functions for Lua), `plugin_enable`/`plugin_shutdown`, and `plugin_onupdate` (locks the mutex and calls `dfplex_update` each tick).

### Lua integration (`lua.cpp`)

The plugin exposes native functions to DFHack Lua — client enumeration, get/set cursor & view coords, `register_cb_post_state_restore(cb)`, and mutex lock/unlock. The module shim is `dist/shared/hack/lua/plugins/dfplex.lua`; `dist/shared/hack/scripts/dfplex_restrict_z.lua` is an example script built on it.

### Web client (`static/`)

`dfplex.html` + `js/dfplex.js` (websocket protocol, decodes delta-encoded CURSES screens, renders tiles to canvas), `js/params.js` (query-string + `localStorage` config), `js/keycode.js` (keyboard → DF key mapping), and `config.js` (default settings, overridable per-URL). Tilesets live in `static/art/`, colorschemes in `static/colors/`. Players configure via URL query params (`tiles`, `colors`, `nick`, `port`, `hide-chat`, `store`, …) — fully documented in `static/README.md`.

## Configuration — authoritative source

Runtime config is `data/init/dfplex.txt` (DF-raws syntax, e.g. `[PORT:1234]`), parsed by `parse_config.cpp`/`config.cpp` into the extern globals declared in `config.hpp`. Keyboard options are given as **ASCII codes** (`0` disables). Notable keys: `STATICPORT`, `PORT`, `MAX_CLIENTS`, `MULTIPLEXKEY`, `PAUSE` (`ALWAYS`/`EXPLICIT`/`EXPLICIT_DWARFMENU`/`EXPLICIT_ANYMENU`), `CHATKEY`, `KEYSTACK_MAX`. The canonical copy is `dist/shared/data/init/dfplex.txt`.

⚠️ **Stale docs:** `server/README.md` (the `WF_PORT`/`WF_MAX_CLIENTS` environment variables), `INSTALLING.txt`, and `package.sh` (`DF_VER="40.16"`, win32 packaging) describe the old Webfort setup and **do not reflect current behavior**. Trust `dfplex.txt` + `config.hpp` for configuration, and `README.md`/`OVERVIEW.md` for everything else.

## Security

DFPlex is **not sandboxed** — no effort is made to stop a connected client from reaching the host filesystem. Treat any exposed instance as untrusted; isolate (container/VM) before opening it beyond people you trust.
