"use strict";

const path = require("node:path");
const fs = require("node:fs");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "",
    process.platform === "darwin" ? "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" : "",
    process.platform === "win32" ? path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe") : "",
    process.platform === "win32" ? path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe") : "",
    process.platform === "win32" ? path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe") : "",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate));
}

function normalizeManagerNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `${digits}@c.us` : "";
}


// Railway keeps the profile on a volume, but each deployment has a new hostname.
// Remove only Chromium's process markers left by a previous container.
function clearPreviousContainerLock(authDirectory) {
  if (!process.env.RAILWAY_ENVIRONMENT_ID) return;
  const profile = path.join(path.resolve(authDirectory), "session");
  let lock;
  try {
    lock = fs.readlinkSync(path.join(profile, "SingletonLock"));
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EINVAL") return;
    throw error;
  }
  const ownerHost = lock.slice(0, lock.lastIndexOf("-"));
  if (!ownerHost || ownerHost === require("node:os").hostname()) return;
  for (const name of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    try {
      fs.unlinkSync(path.join(profile, name));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

function createWhatsAppBridge({ agent, authDirectory, managerNumber = "", onState = () => {} }) {
  const state = { status: "starting", qrDataUrl: "", pairingCode: "", account: "" };
  let pairingRequested = false;
  const managerChatId = normalizeManagerNumber(managerNumber);
  const executablePath = findChromeExecutable();
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.resolve(authDirectory) }),
    puppeteer: {
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote"
      ]
    }
  });

  const update = patch => {
    Object.assign(state, patch);
    onState({ ...state });
  };

  client.on("qr", async qr => {
    if (pairingRequested) return;
    update({ status: "waiting_qr", qrDataUrl: await QRCode.toDataURL(qr, { width: 320, margin: 1 }) });
  });
  client.on("code", code => update({ status: "waiting_code", pairingCode: String(code), qrDataUrl: "", error: "" }));
  client.on("authenticated", () => update({ status: "authenticated", qrDataUrl: "", pairingCode: "" }));
  client.on("ready", () => update({ status: "ready", qrDataUrl: "", pairingCode: "", account: client.info?.wid?._serialized || "" }));
  client.on("auth_failure", message => update({ status: "auth_failure", error: String(message) }));
  client.on("disconnected", reason => update({ status: "disconnected", error: String(reason) }));

  client.on("message", async message => {
    try {
      if (message.fromMe || message.from.endsWith("@g.us") || message.from === "status@broadcast") return;
      const contact = await message.getContact();
      const result = await agent.handle({
        chatId: message.from,
        text: message.body,
        profileName: contact.pushname || contact.name || "",
        phone: contact.number || ""
      });
      for (const reply of result.replies || []) {
        await new Promise(resolve => setTimeout(resolve, 650));
        await client.sendMessage(message.from, reply);
      }
      if (result.completed && result.summary && managerChatId && managerChatId !== message.from) {
        await client.sendMessage(managerChatId, result.summary, { sendSeen: false, waitUntilMsgSent: true });
      }
    } catch (error) {
      update({ status: "error", error: error.message });
    }
  });

  return {
    state,
    sendManagerNotification: async text => {
      if (!managerChatId) throw new Error("No hay un WhatsApp de Leslie configurado.");
      if (state.status !== "ready") throw new Error("WhatsApp no está conectado.");
      const sent = await client.sendMessage(managerChatId, String(text), { sendSeen: false, waitUntilMsgSent: true });
      return sent.id?._serialized || "sent";
    },
    start: async () => {
      try {
        clearPreviousContainerLock(authDirectory);
        return await client.initialize();
      } catch (error) {
        update({ status: "error", error: error.message, qrDataUrl: "" });
        throw error;
      }
    },
    stop: () => client.destroy(),
    requestPairingCode: async phoneNumber => {
      const digits = String(phoneNumber || "").replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) throw new Error("Escribe el número completo con código de país.");
      if (!client.pupPage) throw new Error("WhatsApp todavía está iniciando. Espera unos segundos e inténtalo otra vez.");
      pairingRequested = true;
      update({ status: "requesting_code", qrDataUrl: "", pairingCode: "", error: "" });
      try {
        const code = await client.requestPairingCode(digits, true, 180000);
        update({ status: "waiting_code", pairingCode: String(code), qrDataUrl: "", error: "" });
        return String(code);
      } catch (error) {
        pairingRequested = false;
        update({ status: "waiting_qr", pairingCode: "", error: error.message });
        throw error;
      }
    },
    client
  };
}

module.exports = { createWhatsAppBridge, normalizeManagerNumber, findChromeExecutable };
