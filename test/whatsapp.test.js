"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { createAgent } = require("../src/agent");

function mockedBridge(options, resolve) {
  const file = path.resolve(__dirname, "../src/whatsapp.js");
  const realRequire = createRequire(file);
  class Client {
    constructor() { this.handlers = {}; this.sent = []; }
    on(event, handler) { this.handlers[event] = handler; }
    getContactLidAndPhone(ids) { return resolve(ids); }
    async sendMessage(to, body) { this.sent.push({ to, body }); return {}; }
  }
  const context = {
    module: { exports: {} }, process, console,
    setTimeout: callback => callback(),
    require: name => name === "whatsapp-web.js" ? { Client, LocalAuth: class {} }
      : name === "qrcode" ? {} : realRequire(name)
  };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return context.module.exports.createWhatsAppBridge({ authDirectory: "/tmp/leslie-test", ...options });
}

test("el puente envía a Leslie el PN y mantiene el LID como destino del chat", async () => {
  const lid = "30387011113123@lid";
  const phone = "13055550123";
  const records = new Map([[lid, { id: lid, phone: "30387011113123", step: "contactTime", status: "new", answers: { vehicle: "Camry" } }]]);
  const agent = createAgent({ loadLead: async id => records.get(id), saveLead: async lead => records.set(lead.id, lead) });
  const bridge = mockedBridge({ agent, managerNumber: "17865550199" }, async ids => ids.map(id => ({ lid: id === lid ? lid : "98765432101234@lid", pn: id === lid ? `${phone}@c.us` : id })));
  await bridge.client.handlers.message({ from: lid, body: "3 pm", getContact: async () => ({ number: "30387011113123", pushname: "Misael" }) });
  assert.equal(bridge.client.sent.length, 2);
  assert.equal(bridge.client.sent[0].to, lid);
  assert.equal(bridge.client.sent[1].to, "98765432101234@lid");
  assert.match(bridge.client.sent[1].body, /Teléfono: 13055550123/);
  assert.doesNotMatch(bridge.client.sent[1].body, /30387011113123/);
});

test("no envía ficha al broker mientras falta el teléfono", async () => {
  const lid = "30387011113123@lid";
  let record = { id: lid, phone: "", step: "contactTime", status: "new", answers: {} };
  const agent = createAgent({ loadLead: async () => record, saveLead: async lead => { record = lead; } });
  const bridge = mockedBridge({ agent, managerNumber: "17865550199" }, async () => [{ lid }]);
  await bridge.client.handlers.message({ from: lid, body: "3 pm", getContact: async () => ({ number: "30387011113123" }) });
  assert.equal(bridge.client.sent.length, 1);
  assert.match(bridge.client.sent[0].body, /número puede llamarte/);
});

test("al conectar repara fichas antiguas y respeta una actualización concurrente", async () => {
  const lid = "30387011113123@lid";
  const old = { id: lid, phone: "30387011113123", answers: { vehicle: "Camry" } };
  let current = old;
  const bridge = mockedBridge({
    agent: {}, listLeads: async () => [old], loadLead: async () => current,
    saveLead: async lead => { current = lead; }
  }, async () => {
    current = { ...old, answers: { vehicle: "Corolla" } };
    return [{ lid, pn: "13055550123@c.us" }];
  });
  await bridge.client.handlers.ready();
  assert.equal(current.phone, "13055550123");
  assert.equal(current.answers.vehicle, "Corolla");
  assert.equal(bridge.client.sent.length, 0);
});
