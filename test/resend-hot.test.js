"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { resendHotLeads } = require("../src/resend-hot");

const answers = { vehicle: "Camry", budget: "520", urgency: "Esta semana", contactTime: "3 pm" };
function lead(id, name, phone, extra = {}) { return { id, name, phone, status: "qualified", answers, ...extra }; }
async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "leslie-resend-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("envía sólo calientes reales con teléfono y guarda evidencia sin duplicar", async t => {
  const directory = await temporary(t);
  const messages = [];
  let leads = [
    lead("30387011113123@lid", "Misael", "13055550123"),
    lead("40487011113123@lid", "Sin teléfono", "40487011113123"),
    lead("13055550124@c.us", "Frío", "13055550124", { answers: {} }),
    lead("13055550125@c.us", "Prueba QA", "13055550125")
  ];
  const options = { directory, listLeads: async () => leads, send: async body => { messages.push(body); return "message-1"; }, log: () => {} };
  const result = await resendHotLeads(options);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Cliente: Misael/);
  assert.match(messages[0], /Teléfono: 13055550123/);
  assert.doesNotMatch(messages[0], /30387011113123/);
  assert.equal(result.skippedWithoutPhone, 1);
  assert.equal(result.entries[0].messageId, "message-1");
  assert.ok(result.completedAt);
  leads.push(lead("13055550126@c.us", "Nuevo", "13055550126"));
  await resendHotLeads(options);
  assert.equal(messages.length, 1);
});

test("una entrega incierta no se repite automáticamente", async t => {
  const directory = await temporary(t);
  let calls = 0;
  const options = { directory, listLeads: async () => [lead("13055550123@c.us", "Misael", "13055550123")], send: async () => { calls++; throw Error("timeout"); }, log: () => {} };
  await assert.rejects(resendHotLeads(options), /timeout/);
  const result = await resendHotLeads(options);
  assert.equal(calls, 1);
  assert.equal(result.entries[0].status, "uncertain");
  assert.equal(result.completedAt, undefined);
});
