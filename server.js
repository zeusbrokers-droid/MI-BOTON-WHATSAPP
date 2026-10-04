"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");
const { LeadStore } = require("./src/store");
const { createAgent } = require("./src/agent");
const { createWhatsAppBridge } = require("./src/whatsapp");

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");

function disabledBridge() {
  return {
    state: { status: "disabled", qrDataUrl: "", pairingCode: "", account: "" },
    start: async () => {},
    stop: async () => {},
    requestPairingCode: async () => { throw new Error("WhatsApp está desactivado."); }
  };
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authorized(request) {
  const password = process.env.PANEL_PASSWORD || "";
  if (!password) return true;
  const header = String(request.headers.authorization || "");
  if (!header.startsWith("Basic ")) return false;
  let credentials;
  try {
    credentials = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const separator = credentials.indexOf(":");
  if (separator < 0) return false;
  const username = credentials.slice(0, separator);
  const suppliedPassword = credentials.slice(separator + 1);
  return secureEqual(username, process.env.PANEL_USER || "leslie") && secureEqual(suppliedPassword, password);
}

function requireAuthorization(response) {
  response.writeHead(401, {
    "www-authenticate": 'Basic realm="Leslie Car Miami", charset="UTF-8"',
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify({ error: "Acceso protegido" }));
}

function mime(file) {
  return ({ ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" })[path.extname(file)] || "application/octet-stream";
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new Error("Solicitud demasiado grande.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function serveStatic(response, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(PUBLIC, relative);
  if (!file.startsWith(`${PUBLIC}${path.sep}`) && file !== path.join(PUBLIC, "index.html")) return false;
  try {
    const content = await fs.readFile(file);
    response.writeHead(200, { "content-type": mime(file), "cache-control": "no-cache" });
    response.end(content);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function startServer() {
  if (process.env.RAILWAY_ENVIRONMENT_ID && (!process.env.PANEL_PASSWORD || process.env.PANEL_PASSWORD.length < 16)) {
    throw new Error("Railway requiere PANEL_PASSWORD de al menos 16 caracteres.");
  }
  const dataRoot = process.env.LESLIE_DATA_DIR || path.join(ROOT, "data");
  const store = new LeadStore(path.join(dataRoot, "records"));
  await store.init();
  const agent = createAgent({ loadLead: id => store.get(id), saveLead: lead => store.save(lead) });
  const bridge = process.env.WHATSAPP_DISABLED === "1"
    ? disabledBridge()
    : createWhatsAppBridge({
        agent,
        authDirectory: path.join(dataRoot, "whatsapp-session"),
        managerNumber: process.env.MANAGER_WHATSAPP_NUMBER || ""
      });

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      if (request.method === "GET" && url.pathname === "/api/health") return json(response, 200, { ok: true });
      if (!authorized(request)) return requireAuthorization(response);
      if (request.method === "GET" && url.pathname === "/api/status") return json(response, 200, bridge.state);
      if (request.method === "POST" && url.pathname === "/api/pairing-code") {
        try {
          const body = await readJson(request);
          const code = await bridge.requestPairingCode(body.phoneNumber);
          return json(response, 200, { code });
        } catch (error) {
          return json(response, 400, { error: error.message });
        }
      }
      if (request.method === "GET" && url.pathname === "/api/leads") return json(response, 200, { leads: await store.list() });
      if (request.method === "GET" && await serveStatic(response, url.pathname)) return;
      json(response, 404, { error: "No encontrado" });
    } catch (error) {
      json(response, 500, { error: error.message });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "0.0.0.0", resolve);
  });
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`Panel Leslie Car: ${url}`);

  bridge.start().catch(error => console.error("No se pudo iniciar WhatsApp:", error));
  const stop = async () => {
    await bridge.stop().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  };
  return { url, server, bridge, stop };
}

if (require.main === module) {
  startServer().then(runtime => {
    const shutdown = async () => {
      await runtime.stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }).catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { startServer };
