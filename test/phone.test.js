"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveContactPhone, normalizePhone, leadPhone } = require("../src/phone");
const { createAgent, summary } = require("../src/agent");
const lid = "30387011113123@lid";
const phone = "13055550123";

function memoryAgent(initial) {
  const leads = new Map(initial ? [[initial.id, initial]] : []);
  return { leads, agent: createAgent({
    loadLead: async id => leads.get(id),
    saveLead: async lead => leads.set(lead.id, lead)
  }) };
}

test("resuelve el LID a PN y nunca usa contact.number como teléfono", async () => {
  const client = { getContactLidAndPhone: async ids => {
    assert.deepEqual(ids, [lid]);
    return [{ lid, pn: `${phone}@c.us` }];
  } };
  assert.equal(await resolveContactPhone(client, lid, { number: "30387011113123" }), phone);
  client.getContactLidAndPhone = async () => [{ lid }];
  assert.equal(await resolveContactPhone(client, lid, { number: "30387011113123" }), "");
  client.getContactLidAndPhone = async () => { throw Error("unavailable"); };
  assert.equal(await resolveContactPhone(client, lid, { number: "30387011113123" }), "");
  assert.equal(await resolveContactPhone(client, `${phone}@c.us`), phone);
});

test("formatea teléfonos y rechaza IDs y texto sin teléfono", () => {
  assert.equal(normalizePhone("+1 (305) 555-0123"), phone);
  assert.equal(normalizePhone("3055550123"), phone);
  assert.equal(normalizePhone("3 pm"), "");
  assert.equal(normalizePhone(lid), "");
  assert.equal(leadPhone({ id: lid, phone: "30387011113123" }), "");
});

test("recoge un teléfono antes de enviar el prospecto sin perder el horario", async () => {
  const { agent, leads } = memoryAgent();
  await agent.handle({ chatId: lid, text: "¿Cuál es el precio?", profileName: "Misael" });
  const pending = await agent.handle({ chatId: lid, text: "3 pm" });
  assert.equal(pending.completed, false);
  assert.equal(pending.summary, undefined);
  assert.equal(pending.lead.phone, "");
  assert.match(pending.replies[0], /número puede llamarte/);
  const invalid = await agent.handle({ chatId: lid, text: "ok" });
  assert.equal(invalid.completed, false);
  const complete = await agent.handle({ chatId: lid, text: "+1 (305) 555-0123" });
  assert.equal(complete.completed, true);
  assert.match(complete.summary, /Teléfono: 13055550123/);
  assert.doesNotMatch(complete.summary, /30387011113123/);
  assert.equal(leads.get(lid).answers.contactTime, "3 pm");
});

test("resuelve automáticamente mientras espera teléfono", async () => {
  const { agent } = memoryAgent({ id: lid, phone: "", step: "phone", status: "awaiting_phone", answers: { contactTime: "3 pm" } });
  const result = await agent.handle({ chatId: lid, text: "Hola", phone });
  assert.equal(result.completed, true);
  assert.match(result.summary, /Teléfono: 13055550123/);
});

test("corrige un prospecto antiguo sin borrar la calificación", async () => {
  const answers = { vehicle: "Camry LE", budget: "520", urgency: "Esta semana", contactTime: "3 pm" };
  const old = { id: lid, name: "Misael", phone: "30387011113123", status: "qualified", step: "complete", answers };
  const { agent, leads } = memoryAgent(old);
  assert.doesNotMatch(summary(old), /30387011113123/);
  const result = await agent.handle({ chatId: lid, text: "Hola", phone });
  assert.equal(result.completed, true);
  assert.equal(leads.get(lid).phone, phone);
  assert.deepEqual(result.lead.answers, answers);
  assert.equal(result.lead.classification.code, "hot");
});

test("un prospecto antiguo sin PN pide teléfono y conserva sus respuestas", async () => {
  const { agent } = memoryAgent({ id: lid, phone: "30387011113123", status: "qualified", step: "complete", answers: { vehicle: "Camry" } });
  const result = await agent.handle({ chatId: lid, text: "Hola" });
  assert.equal(result.completed, false);
  assert.equal(result.lead.answers.vehicle, "Camry");
  assert.equal(result.lead.step, "phone");
});

test("un teléfono indicado por el cliente se conserva al resolver WhatsApp", async () => {
  const { agent } = memoryAgent({ id: lid, phone, phoneSource: "client", status: "new", step: "budget", answers: {} });
  const result = await agent.handle({ chatId: lid, text: "25000", phone: "13055550456" });
  assert.equal(result.lead.phone, phone);
});

test("importa una ficha multilínea y pide teléfono si tiene un LID", async () => {
  const { agent } = memoryAgent();
  const result = await agent.handle({ chatId: lid, text: `NUEVO PROSPECTO DE TIKTOK\nCliente: Misael\nTeléfono: 30387011113123\nBusca: Camry LE\nHora solicitada: 3 pm` });
  assert.equal(result.completed, false);
  assert.equal(result.lead.answers.vehicle, "Camry LE");
  assert.equal(result.lead.answers.contactTime, "3 pm");
  const complete = await agent.handle({ chatId: lid, text: phone });
  assert.equal(complete.completed, true);
  assert.match(complete.summary, /Cliente: Misael/);
});
