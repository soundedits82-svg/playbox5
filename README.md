# PLAYBOX 5 (v0.1.0)

A console-style TV dashboard with a smartphone that becomes your wireless controller. Zero npm dependencies (Node 22+).

## Run
```
npm start            # prints the TV URL, e.g. http://192.168.1.20:8080/tv/
```
1. Open the TV URL in the TV's browser (or any desktop browser for testing). `?boot=0` skips the boot sequence; any key skips it too.
2. On the TV: move up to the top bar, select the controller icon, press OK. A QR code and 6-digit code appear.
3. Phone on the same Wi-Fi: scan the QR code (or open `http://<tv-ip>:8080/pad/` and type the code). Rotate to landscape.
4. Navigate the TV with the phone D-pad, **Cross** = OK, **Circle** = Back, **Home** = Home. Select **Orb Rush** and play with the left stick (up to 4 phones + keyboard + USB/Bluetooth gamepads that the browser exposes).

Remote keys: arrows, Enter/OK, Back (Esc/Backspace/GoBack), Home, Play/Pause. Set `PLAYBOX_HOST=<ip>` if the QR code shows the wrong address.

## Tests
```
npm test                                                      # 13 protocol tests
PLAYWRIGHT_BROWSERS_PATH=... NODE_PATH=$(npm root -g) npm run test:ui   # 12 browser tests (needs Playwright + Chromium)
```
See `docs/ARCHITECTURE.md`, `docs/REFERENCE_ANALYSIS.md`, `TODO.md`, `CHANGELOG.md`, and `reports/`.

## Deploy to Render (Android-friendly)

This project is a Node.js HTTP + WebSocket server. Deploy it as a **Web Service**, not a static site.

1. Upload/push the contents of this folder to a GitHub repository.
2. In Render, choose **New + → Web Service** and connect that repository.
3. If the repository contains this project at its root, use the included `render.yaml` (or set Runtime `Node`, Build Command `npm install`, Start Command `npm start`). If it is inside a subfolder, set that folder as Render's **Root Directory**.
4. Deploy. Render supplies `PORT` and `RENDER_EXTERNAL_URL`; the server uses the public HTTPS URL when generating the phone-controller QR code.
5. Open `https://YOUR-SERVICE.onrender.com/tv/` on the Samsung TV. Open `/pad/` on the Android phone or scan the TV's QR code and enter the 6-digit pairing code.

Health check: `/api/health`. WebSocket endpoint: `/ws` (automatically uses `wss://` on HTTPS pages).

Note: Render's free service may spin down after inactivity, so the first visit after a while can take some time to start. Keep the TV and phone connected to the same deployed service URL.
