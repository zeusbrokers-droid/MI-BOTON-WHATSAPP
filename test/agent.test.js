"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createAgent, classification, parseImportedLead, validContactTime } = require("../src/agent");

function memoryAgent() {
  const leads = new Map();
  const agent = createAgent({
    loadLead: async id => leads.get(id) || null,
    saveLead: async lead => { leads.set(lead.id, lead); return lead; }
  });
  return { agent, leads };
}

test("clasifica un prospecto listo como caliente", () => {
  const result = classification({ vehicle:"Toyota Camry", budget:"$25,000", urgency:"Hoy", contactTime:"5 pm" });
  assert.equal(result.code, "hot");
});

test("empieza con una sola pregunta", async () => {
  const { agent } = memoryAgent();
  const result = await agent.handle({ chatId:"1@c.us", text:"Hola, vengo de Instagram", profileName:"Ana" });
  assert.equal(result.replies.length, 1);
  assert.match(result.replies[0], /auto en específico/i);
  assert.equal(result.lead.source, "Instagram");
});

test("completa el flujo financiado y produce ficha", async () => {
  const { agent, leads } = memoryAgent();
  const id="2@c.us";
  const messages=[
    "Hola, vengo de TikTok","Busco uno específico","Toyota Camry 2022","$25,000","Financiado","Bueno","$3,000","ITIN","Sí","Hoy","No","Después de las 5"
  ];
  let result;
  for(const text of messages)result=await agent.handle({chatId:id,text,profileName:"Prueba QA",phone:"7865550100"});
  assert.equal(result.completed,true);
  assert.equal(result.lead.classification.code,"hot");
  assert.match(result.summary,/Clasificación: 🔥 Caliente/);
  assert.equal(leads.get(id).status,"qualified");
});

test("importa la ficha del asistente web sin repetir preguntas", async () => {
  const text=`🔥 NUEVO PROSPECTO DE LESLIE CAR MIAMI
Cliente: Prueba QA
Teléfono: 7865550100
Fuente: TikTok
Busca: Toyota Camry 2022
Presupuesto: $25,000
Pago: Financiado
Inicial: $3,000
Urgencia: Hoy
Hora solicitada: 5 pm`;
  const lead=parseImportedLead(text,{id:"3@c.us",name:"",phone:"",source:"WhatsApp",answers:{}});
  assert.equal(lead.status,"qualified");
  assert.equal(lead.source,"TikTok");
  assert.equal(lead.classification.code,"hot");
});

test("no promete aprobación", async () => {
  const { agent }=memoryAgent();
  const result=await agent.handle({chatId:"4@c.us",text:"¿Me aprueban con mi crédito?"});
  assert.match(result.replies[0],/revisar tu situación/i);
  assert.doesNotMatch(result.replies[0],/estás aprobado|seguro te aprueban/i);
});

test("una pregunta de precio se deriva correctamente a horario", async () => {
  const { agent }=memoryAgent();
  const id="5@c.us";
  const first=await agent.handle({chatId:id,text:"¿Cuál es el precio final?",profileName:"Luis"});
  assert.match(first.replies[0],/Leslie te puede confirmar/i);
  assert.equal(first.lead.step,"contactTime");
  const second=await agent.handle({chatId:id,text:"A las 6 pm"});
  assert.equal(second.completed,true);
  assert.equal(second.lead.answers.contactTime,"A las 6 pm");
  assert.equal(second.lead.classification.code,"warm");
});

test("vuelve a pedir una hora inválida y luego cierra sin inventarla", async () => {
  const { agent }=memoryAgent();
  const id="6@c.us";
  await agent.handle({chatId:id,text:"¿Cuál es el precio final?",profileName:"Luis"});
  const retry=await agent.handle({chatId:id,text:"ok"});
  assert.equal(retry.completed,false);
  assert.match(retry.replies[0],/hora aproximada/i);
  const closed=await agent.handle({chatId:id,text:"no sé"});
  assert.equal(closed.completed,true);
  assert.equal(closed.lead.answers.contactTime,"No indicada");
  assert.doesNotMatch(closed.replies[0],/contactarte a las/i);
});

test("reconoce horarios flexibles de cierre", () => {
  assert.equal(validContactTime("después de las 5"),true);
  assert.equal(validContactTime("en la mañana"),true);
  assert.equal(validContactTime("ok"),false);
});
