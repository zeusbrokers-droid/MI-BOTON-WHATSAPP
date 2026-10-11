"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { classification, summary } = require("./agent");
const { leadPhone } = require("./phone");

// One explicit user request. A durable snapshot prevents later leads or restarts
// from expanding the audience or repeating a message with an uncertain outcome.
const OPERATION = "leslie-hot-2026-10-11-181651";

async function resendHotLeads({ directory, listLeads, send, verify = async () => "", log = console.log }) {
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, `${OPERATION}.json`);
  let operation;
  try {
    operation = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (Date.now() > Date.parse("2026-10-12T18:16:51Z")) {
      log(`${OPERATION}: solicitud puntual vencida; no se crea otro envío.`);
      return { id: OPERATION, entries: [] };
    }
    const leads = await listLeads();
    const hot = leads.filter(lead => ["qualified", "handoff"].includes(lead.status)
      && classification(lead.answers || {}).code === "hot"
      && !/\b(prueba|qa|demo|test)\b/i.test(lead.name || ""));
    operation = {
      id: OPERATION, createdAt: new Date().toISOString(),
      skippedWithoutPhone: hot.filter(lead => !leadPhone(lead)).length,
      entries: hot.filter(lead => leadPhone(lead)).map(lead => ({
        leadId: lead.id, name: lead.name || "Sin nombre", status: "pending",
        body: `📌 FICHA ACTUALIZADA — TELÉFONO CORREGIDO\n\n${summary({ ...lead, classification: classification(lead.answers) })}`
      }))
    };
  }
  const persist = async () => {
    const temporary = `${file}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(operation, null, 2), { mode: 0o600 });
    await fs.rename(temporary, file);
  };
  if (operation.completedAt) {
    log(`${OPERATION}: envío ya completado; no se repite.`);
    return operation;
  }
  await persist();
  log(`${OPERATION}: ${operation.entries.length} fichas calientes; ${operation.skippedWithoutPhone} sin teléfono.`);
  for (const entry of operation.entries) {
    if (["sending", "uncertain"].includes(entry.status)) {
      const messageId = await verify(entry.body, operation.createdAt);
      if (messageId) {
        entry.status = "sent";
        entry.messageId = messageId;
        entry.verifiedAt = new Date().toISOString();
        await persist();
        log(`${OPERATION}: ficha verificada en el chat: ${entry.name}.`);
      }
      continue;
    }
    if (entry.status !== "pending") continue;
    entry.status = "sending";
    await persist();
    try {
      const messageId = await send(entry.body);
      if (!messageId || messageId === "accepted") throw new Error("WhatsApp no devolvió un identificador de mensaje.");
      entry.status = "sent";
      entry.messageId = messageId;
      entry.sentAt = new Date().toISOString();
      await persist();
      log(`${OPERATION}: ficha enviada: ${entry.name}; envío confirmado por WhatsApp.`);
    } catch (error) {
      entry.status = "uncertain";
      entry.error = error.message;
      await persist();
      throw error;
    }
  }
  const sent = operation.entries.filter(entry => entry.status === "sent").length;
  const uncertain = operation.entries.filter(entry => entry.status !== "sent").length;
  if (!uncertain) {
    operation.completedAt = new Date().toISOString();
    await persist();
  }
  log(`${OPERATION}: resultado: ${sent} enviadas; ${uncertain} inciertas; ${operation.skippedWithoutPhone} sin teléfono.`);
  return operation;
}

module.exports = { resendHotLeads };
