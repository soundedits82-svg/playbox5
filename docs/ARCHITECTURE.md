# Architecture (v0.1)
```
 Phone (browser /pad)  --WebSocket-->  Hub (Node, server/)  --WebSocket-->  TV UI (browser /tv)
   touch controls                      pairing, sessions,                    focus manager, library,
   vibrate <------ rumble -------------relay, rate limit                     games, emulator host (planned)
```
**Decision: web-first.** The TV UI and phone pad are plain HTML/JS so they run on desktop, Android TV browsers and phones today, and can be tested headlessly. The Android TV app (Kotlin) will start as a thin shell hosting this UI in a WebView, then gain native modules (libretro emulator cores via JNI, USB/Bluetooth input, file import) behind a bridge. Jetpack Compose is not used for the dashboard, because rewriting the working UI would add risk and no new capability.

**Hub protocol** (JSON over WebSocket, `/ws`): TV `{t:tv,sid}` -> `session{sid,code,url,qr,pads}`; phone `{t:join,code,name}` -> `joined{slot,token}`; `{t:resume,token}` after a drop; input `{t:b,k,d}` and `{t:s,k:l|r,x,y}` forwarded to the TV with the player slot; TV `{t:rumble,slot,ms}`; `{t:ping}`/`pong` for latency.
**Security:** 6-digit random code per TV session; 16-byte random resume token; 5 failed codes/min per IP lock-out; max 4 pads; payload validated and clamped; static server whitelists `/tv` and `/pad` only. **Known limit:** plain HTTP/WS on the LAN (no TLS), fine for a home network, not for untrusted Wi-Fi.
**QR:** in-repo encoder (`server/qr.js`), decoded successfully with OpenCV.
**Input model on the TV:** every source (keyboard/remote, phones, Gamepad API) feeds `setBtn()`; menus map them to remote actions, games read the same pad state.
**Planned modules:** `library` (SQLite, import by platform), `store` (official/open-source/public-domain catalogue only), `emulators/<core>` (libretro-style interface, save states, per-game config, compatibility DB), `streaming` (legitimate remote-play research). PS3/PS5 titles are **not** claimed to run; PS5 means remote play/streaming only, where officially supported.
