import express from "express";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from "@whiskeysockets/baileys";
import pino from "pino";

const PORT = 3099;

// Auth stored under %APPDATA%/lead-gen/wa-auth
const AUTH_DIR = path.join(
  process.env.APPDATA || process.env.HOME || ".",
  "lead-gen",
  "wa-auth"
);

const logger = pino({ level: "silent" });

// ── State ─────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

let sock = null;
let qrDataUrl = null;
let isConnected = false;
let reconnectTimer = null;
let reconnectDelay = 3000;
let authWipeCount = 0;

function wipeAuthAndReconnect(reason) {
  authWipeCount++;
  if (authWipeCount > 3) {
    console.error("[wa-sidecar] Auth wipe loop detected — stopping reconnects. Please restart.");
    return;
  }
  console.log(`[wa-sidecar] ${reason} — wiping auth and reconnecting (attempt ${authWipeCount})…`);
  if (sock) {
    try { sock.ev.removeAllListeners(); sock.end(); } catch {}
    sock = null;
  }
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
  qrDataUrl = null;
  isConnected = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = 2000 + authWipeCount * 2000;
  console.log(`[wa-sidecar] Waiting ${delay / 1000}s before reconnect…`);
  reconnectTimer = setTimeout(startSocket, delay);
}

process.on("uncaughtException", (err) => {
  console.error("[wa-sidecar] Uncaught exception:", err.message);
  if (err.code === "EADDRINUSE") {
    console.log("[wa-sidecar] Port 3099 already in use — another instance running. Exiting.");
    process.exit(0);
  }
  if (err.message?.includes("Zero-length key") || err.message?.includes("DataError") || err.name === "DOMException") {
    wipeAuthAndReconnect("Corrupted auth state detected");
  }
});

process.on("unhandledRejection", (reason) => {
  const msg = reason?.message || String(reason);
  console.error("[wa-sidecar] Unhandled rejection:", msg);
  if (msg.includes("Zero-length key") || msg.includes("DataError")) {
    wipeAuthAndReconnect("Corrupted auth state detected");
  }
});

// ── WhatsApp socket ───────────────────────────────────────────────────────────
async function startSocket() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  if (sock) {
    try { sock.ev.removeAllListeners(); sock.end(); } catch {}
    sock = null;
  }

  try {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  } catch (e) {
    console.error("[wa-sidecar] Cannot create auth dir:", e.message);
    reconnectTimer = setTimeout(startSocket, 5000);
    return;
  }

  let state, saveCreds;
  try {
    ({ state, saveCreds } = await useMultiFileAuthState(AUTH_DIR));
  } catch (e) {
    console.error("[wa-sidecar] Auth state error:", e.message);
    wipeAuthAndReconnect("Failed to load auth state");
    return;
  }

  let version;
  try {
    const latest = await fetchLatestBaileysVersion();
    version = latest.version;
    console.log(`[wa-sidecar] Using WA version ${version.join(".")}`);
  } catch {
    version = [2, 3000, 1024006978];
    console.warn(`[wa-sidecar] fetchLatestBaileysVersion failed, using fallback ${version.join(".")}`);
  }

  try {
    sock = makeWASocket({
      version,
      browser: Browsers.ubuntu("Chrome"),
      auth: state,
      printQRInTerminal: false,
      logger,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      getMessage: async () => undefined,
    });
  } catch (e) {
    console.error("[wa-sidecar] makeWASocket error:", e.message);
    if (e.message?.includes("Zero-length key") || e.message?.includes("DataError")) {
      wipeAuthAndReconnect("Crypto error during socket creation");
    } else {
      reconnectTimer = setTimeout(startSocket, 5000);
    }
    return;
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        qrDataUrl = await QRCode.toDataURL(qr);
        console.log("[wa-sidecar] QR ready — waiting for scan");
        authWipeCount = 0;
      } catch (e) {
        console.error("[wa-sidecar] QR encode error:", e.message);
      }
      isConnected = false;
    }

    if (connection === "open") {
      isConnected = true;
      qrDataUrl = null;
      reconnectDelay = 3000;
      authWipeCount = 0;
      console.log("[wa-sidecar] WhatsApp connected ✓");
    }

    if (connection === "close") {
      isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log(`[wa-sidecar] Connection closed. code=${statusCode} loggedOut=${loggedOut}`);

      if (loggedOut || statusCode === 405) {
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
        qrDataUrl = null;
      }

      reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      console.log(`[wa-sidecar] Reconnecting in ${reconnectDelay / 1000}s…`);
      reconnectTimer = setTimeout(startSocket, reconnectDelay);
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

// ── REST API ──────────────────────────────────────────────────────────────────

// GET /api/status — connection state + QR (if pending scan)
app.get("/api/status", (_req, res) => {
  res.json({ connected: isConnected, qr: qrDataUrl ?? null });
});

// POST /api/send — send a WhatsApp message
// Body: { phone: "919876543210", message: "Hello!" }
app.post("/api/send", async (req, res) => {
  const { phone, message } = req.body ?? {};
  if (!phone || !message) {
    return res.status(400).json({ error: "phone and message are required" });
  }
  if (!isConnected || !sock) {
    return res.status(503).json({ error: "WhatsApp is not connected. Scan the QR code in Settings." });
  }
  try {
    await sock.sendMessage(`${phone}@s.whatsapp.net`, { text: message });
    res.json({ ok: true });
  } catch (e) {
    console.error("[wa-sidecar] sendMessage error:", e);
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

// POST /api/logout — disconnect and wipe credentials
app.post("/api/logout", async (_req, res) => {
  try {
    if (sock) {
      try { await sock.logout(); } catch {}
      sock = null;
    }
    isConnected = false;
    qrDataUrl = null;
    try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
    reconnectTimer = setTimeout(startSocket, 1000);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, "127.0.0.1", () => {
  console.log(`[wa-sidecar] Listening on http://127.0.0.1:${PORT}`);
  startSocket();
});
