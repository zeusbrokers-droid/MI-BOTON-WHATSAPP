"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mergeConversation } = require("../src/whatsapp");

test("guarda el historial del cliente y del agente sin duplicar mensajes", () => {
  const lead = { id: "cliente@c.us", conversation: [{ id: "1", text: "Hola", direction: "inbound", timestamp: "2026-11-03T06:00:00.000Z" }] };
  const updated = mergeConversation(lead, [
    { id: "1", text: "Hola", direction: "inbound", timestamp: "2026-11-03T06:00:00.000Z" },
    { id: "2", text: "¿Tienes 21 años o más?", direction: "outbound", timestamp: "2026-11-03T06:00:01.000Z" }
  ]);
  assert.equal(updated.conversation.length, 2);
  assert.equal(updated.conversation[1].direction, "outbound");
  assert.equal(updated.lastMessageAt, "2026-11-03T06:00:01.000Z");
});
