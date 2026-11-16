import express from "express";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import QRCode from "qrcode";
import { createPairCode, isValidCode, makeSession } from "./src/session.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const PORT = Number(process.env.PORT || 4173);
const sessions = new Map();
const sockets = new WeakMap();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.static("public", { extensions: ["html"] }));

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "PLAYBOX 5", version: "0.2.0" }));

app.post("/api/pair/create", async (req, res) => {
  let code;
  do { code = createPairCode(); } while (sessions.has(code));
  const session = makeSession(code);
  sessions.set(code, session);
  const host = req.get("host");
  const protocol = req.protocol === "https" ? "https" : "http";
  const controllerUrl = `${protocol}://${host}/controller.html?code=${code}`;
  try {
    const qr = await QRCode.toDataURL(controllerUrl, { margin: 1, width: 260, color: { dark: "#101018", light: "#ffffff" } });
    res.json({ code, controllerUrl, qr, expiresIn: 300 });
  } catch {
    sessions.delete(code);
    res.status(500).json({ error: "Could not create pairing QR code." });
  }
});

app.post("/api/pair/close", (req, res) => {
  const code = String(req.body?.code || "");
  const session = sessions.get(code);
  if (session) {
    for (const peer of [session.tv, session.phone]) if (peer?.readyState === WebSocket.OPEN) peer.close(1000, "Pairing closed");
    sessions.delete(code);
  }
  res.json({ ok: true });
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname !== "/ws") return socket.destroy();
  wss.handleUpgrade(request, socket, head, ws => wss.emit("connection", ws, request, url));
});

wss.on("connection", (ws, _request, url) => {
  const role = url.searchParams.get("role");
  const code = url.searchParams.get("code");
  const session = sessions.get(code);
  if (!session || Date.now() > session.expiresAt || !["tv", "phone"].includes(role)) {
    ws.close(1008, "Invalid or expired pairing");
    return;
  }
  if (role === "tv") {
    if (session.tv && session.tv.readyState === WebSocket.OPEN) session.tv.close(4001, "TV reconnected");
    session.tv = ws;
  } else {
    if (!session.tv || session.tv.readyState !== WebSocket.OPEN) {
      ws.close(1008, "TV is not connected yet");
      return;
    }
    if (session.phone && session.phone.readyState === WebSocket.OPEN) session.phone.close(4001, "Phone replaced");
    session.phone = ws;
    session.tv.send(JSON.stringify({ type: "controller-connected" }));
    ws.send(JSON.stringify({ type: "paired" }));
  }
  sockets.set(ws, { code, role });
  ws.on("message", raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    const info = sockets.get(ws);
    if (!info || !["input", "ping"].includes(message.type)) return;
    if (message.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", at: Date.now() }));
      return;
    }
    if (info.role !== "phone" || !session.tv || session.tv.readyState !== WebSocket.OPEN) return;
    const safe = {
      type: "input",
      button: String(message.button || "").slice(0, 24),
      pressed: Boolean(message.pressed),
      value: Number.isFinite(message.value) ? Math.max(-1, Math.min(1, message.value)) : 0,
      axis: String(message.axis || "").slice(0, 12)
    };
    session.tv.send(JSON.stringify(safe));
  });
  ws.on("close", () => {
    const info = sockets.get(ws);
    if (!info) return;
    const current = sessions.get(info.code);
    if (!current) return;
    if (info.role === "tv" && current.tv === ws) {
      current.tv = null;
      current.phone?.close(1001, "TV disconnected");
    }
    if (info.role === "phone" && current.phone === ws) {
      current.phone = null;
      current.tv?.send(JSON.stringify({ type: "controller-disconnected" }));
    }
  });
});

// Expire unused pairing codes and stale sessions.
setInterval(() => {
  for (const [code, session] of sessions) {
    if (Date.now() > session.expiresAt || (!session.tv && !session.phone)) sessions.delete(code);
  }
}, 30_000).unref();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`PLAYBOX 5 is running at http://localhost:${PORT}`);
});
