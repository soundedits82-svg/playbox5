# PLAYBOX 5 — Web Edition

A TV-first browser gaming hub. Open the website in a compatible TV browser; no Android app is required for the web edition.

## Requirements
- Node.js 20+
- A computer/server reachable by the TV and phone on the same network
- A modern browser with Canvas and WebSocket support

## Run locally
```bash
npm install
npm test
npm start
```
Open `http://localhost:4173` on the host computer. For a TV/phone on the same Wi-Fi, find the host computer's LAN IP and open `http://YOUR-LAN-IP:4173` on the TV. Do not use `localhost` on the TV: that points to the TV itself.

## Phone controller
Select the controller icon on the TV. The server creates a short-lived six-digit code and QR code. Scan it with the phone camera. The phone browser opens `/controller.html?code=...` and connects to the same server using WebSocket. Both devices must be able to reach the server. For internet hosting, use HTTPS so the controller uses secure WSS.

## Controls
- TV remote / keyboard: arrows or WASD to move; Enter/OK to select/start; Escape/Backspace to go back.
- Neon Breakout: Left/Right or A/D moves the paddle; Space/Enter starts; Escape returns to the dashboard.
- Phone controller: D-pad and face buttons; touch sticks send normalized axis values.

## Current working scope
- TV-oriented responsive dashboard, Home / Library / Discover navigation
- Search and playable/coming-soon labeling
- Browser game: Neon Breakout
- QR pairing endpoint and phone controller WebSocket relay
- Session expiry and single-phone pairing

## Honest limitations
- This is a browser website, not a native Android TV application.
- Only Neon Breakout is playable in this version. Other tiles are clearly marked coming soon.
- A TV browser must support modern JavaScript, Canvas, WebSocket, and QR camera scanning on the phone.
- Some TV browsers restrict autoplay, WebSocket behavior, focus APIs, or newer CSS. Test on the actual model.
- Public hosting, domain setup, production TLS, persistent accounts, emulator cores, and console-game streaming integrations are not included.
- Do not upload or distribute copyrighted game ROMs, BIOS files, or game assets without authorization.

## Deployment
Deploy the Node application to a Node-compatible host. Set `PORT` if required. Put it behind HTTPS with a reverse proxy/platform TLS. The QR endpoint uses the request host to construct the controller URL, so the public hostname must be the one users open on the TV.


## Cloud deployment (no home PC required)

This repository includes `render.yaml` for a one-service Render deployment.
The free plan may sleep when idle; the first visit can take a little longer to wake.
A paid always-on service is needed for consistently instant availability.

1. Put this project in a GitHub repository (the ZIP can be extracted and uploaded using GitHub's website, including from a phone browser).
2. In Render, choose **New → Blueprint** and connect that GitHub repository.
3. Render reads `render.yaml`, builds with `npm install`, and starts `npm start`.
4. Wait for the deployment to finish, then open the generated `https://...onrender.com` address on the Samsung TV.
5. On the TV, open **Connect Controller**. Scan the QR code using the Android phone camera.
6. Keep the TV page open while using the phone controller.

The host must support persistent WebSocket connections. Keep this as a single server instance:
pairing sessions currently live in server memory and are not shared across multiple instances.
Do not publish the six-digit pairing code or QR screenshot publicly.

### Samsung TV notes
Use the Samsung Internet / TV web browser available on the television and enter the hosted HTTPS address.
Remote key mappings and browser feature support vary by exact TV model and firmware.
If the browser cannot open the controller QR destination, type the short pairing URL shown on the phone/TV manually.
