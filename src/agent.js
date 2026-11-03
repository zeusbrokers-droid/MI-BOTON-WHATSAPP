"use strict";

const { normalizePhone, phoneFromId, leadPhone } = require("./phone");

const HANDOFF = /\b(humano|persona|dueño|propietario|osorio|llamar|hablar|contactar)\b/i;
const PRICE = /\b(precio|cu[aá]nto|costo|cotizaci[oó]n|oferta|descuento)\b/i;
const YES = /^(s[ií]|yes|soy mayor|confirmo|21|tengo 21|mayor de 21)\b/i;
const NO = /^(no|not|soy menor|menor de 21)\b/i;

const QUESTIONS = {
  age: "Para continuar, confirma que tienes 21 años o más respondiendo SÍ.",
  interest: "¿Qué buscas: puros individuales, caja, regalo o pedido para un evento?",
  quantity: "¿Qué cantidad aproximada necesitas?",
  budget: "¿Qué presupuesto aproximado tienes?",
  location: "¿En qué ciudad o zona estás?",
  contactTime: "¿A qué hora te queda mejor que Osorio te contacte?"
};

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeUrgency(text) {
  if (/hoy|ahora|esta tarde|esta noche|urgente/i.test(text)) return "Hoy";
  if (/semana|fin de semana|d[ií]as/i.test(text)) return "Esta semana";
  return "Sin fecha";
}

function validContactTime(text) {
  return /\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:am|pm|a\.?\s*m\.?|p\.?\s*m\.?)?\b/i.test(text)
    || /\b(mañana|tarde|noche|mediod[ií]a|ahora|cualquier hora|despu[eé]s de|antes de)\b/i.test(text);
}

function classification(answers) {
  const qty = clean(answers.quantity);
  const urgent = answers.urgency === "Hoy" || answers.urgency === "Esta semana";
  const bulk = /caja|evento|mayoreo|\b(?:[2-9]\d|1\d{2,})\b/i.test(qty + " " + clean(answers.interest));
  if ((urgent || bulk) && answers.budget && answers.contactTime) {
    return { code: "hot", label: "🔥 Caliente", reason: "Tiene intención definida, cantidad o urgencia y horario de contacto." };
  }
  if (answers.interest && (answers.quantity || answers.budget)) {
    return { code: "warm", label: "🟡 Tibio", reason: "Tiene interés definido, pero todavía requiere seguimiento." };
  }
  return { code: "cold", label: "❄️ Frío", reason: "Aún faltan datos para confirmar intención de compra." };
}

function summary(lead) {
  const a = lead.answers || {};
  const c = lead.classification || classification(a);
  return [
    "📌 NUEVO PROSPECTO — OSORIO CIGAR'S",
    `Clasificación: ${c.label}`,
    `Cliente: ${lead.name || "No indicado"}`,
    `Teléfono: ${leadPhone(lead) || "Pendiente de confirmar"}`,
    "Edad: 21+ confirmada",
    `Busca: ${a.interest || "No indicado"}`,
    `Cantidad: ${a.quantity || "No indicada"}`,
    `Presupuesto: ${a.budget || "No indicado"}`,
    `Ubicación: ${a.location || "No indicada"}`,
    `Urgencia: ${a.urgency || "Sin fecha"}`,
    `Hora solicitada: ${a.contactTime || "No indicada"}`,
    `Fuente: ${lead.source || "WhatsApp Business"}`,
    `Motivo: ${c.reason}`
  ].join("\n");
}

function createAgent({ loadLead, saveLead }) {
  if (typeof loadLead !== "function" || typeof saveLead !== "function") {
    throw new TypeError("createAgent requiere loadLead y saveLead");
  }

  async function handle({ chatId, text, profileName = "", phone = "", source = "" }) {
    const message = clean(text);
    if (!message) return { replies: [] };

    const existing = await loadLead(chatId);
    const lead = existing ? { ...existing, answers: { ...(existing.answers || {}) } } : {
      id: chatId,
      name: clean(profileName),
      phone: normalizePhone(phone) || phoneFromId(chatId),
      phoneSource: "whatsapp",
      source: source || "WhatsApp Business",
      ageConfirmed: false,
      answers: {},
      step: "age",
      status: "new",
      createdAt: new Date().toISOString()
    };

    const resolvedPhone = leadPhone({ id: chatId, phone }) || phoneFromId(chatId);
    if (resolvedPhone && !lead.phone) lead.phone = resolvedPhone;
    lead.updatedAt = new Date().toISOString();

    if (lead.status === "blocked_minor") {
      return { replies: ["No podemos atender ventas de tabaco a menores de 21 años."], lead };
    }

    if (!lead.ageConfirmed) {
      if (NO.test(message)) {
        lead.status = "blocked_minor";
        await saveLead(lead);
        return { replies: ["No podemos atender ventas de tabaco a menores de 21 años."], lead };
      }
      if (!YES.test(message)) {
        await saveLead(lead);
        return { replies: [QUESTIONS.age], lead };
      }
      lead.ageConfirmed = true;
      lead.step = "interest";
      await saveLead(lead);
      return { replies: [QUESTIONS.interest], lead };
    }

    if (/^(reiniciar|empezar de nuevo|restart)$/i.test(message)) {
      const restarted = { ...lead, answers: {}, step: "interest", status: "new", updatedAt: new Date().toISOString() };
      await saveLead(restarted);
      return { replies: [QUESTIONS.interest], lead: restarted };
    }

    if (lead.status === "qualified" || lead.status === "handoff") {
      return { replies: ["Gracias. Osorio continuará contigo personalmente."], lead, handoff: true };
    }

    if (HANDOFF.test(message) && /ahora|direct|humano|persona|dueño|propietario/i.test(message)) {
      lead.status = "handoff";
      await saveLead(lead);
      return { replies: ["Puedes comunicarte directamente con Osorio al +1 786-547-0805."], lead, handoff: true };
    }

    if (PRICE.test(message)) {
      lead.answers.interest = lead.answers.interest || message;
      lead.step = "quantity";
      await saveLead(lead);
      return { replies: ["El precio depende del formato y la cantidad. ¿Cuántos puros o cajas necesitas?"], lead };
    }

    let reply;
    switch (lead.step) {
      case "interest":
        lead.answers.interest = message;
        lead.answers.urgency = normalizeUrgency(message);
        lead.step = "quantity";
        reply = QUESTIONS.quantity;
        break;
      case "quantity":
        lead.answers.quantity = message;
        lead.step = "budget";
        reply = QUESTIONS.budget;
        break;
      case "budget":
        lead.answers.budget = message;
        lead.step = "location";
        reply = QUESTIONS.location;
        break;
      case "location":
        lead.answers.location = message;
        lead.step = "contactTime";
        reply = QUESTIONS.contactTime;
        break;
      case "contactTime":
        if (!validContactTime(message) && !lead.contactTimeRetry) {
          lead.contactTimeRetry = 1;
          reply = "Indica una hora aproximada, por ejemplo: 3 pm, después de las 5 o en la mañana.";
        } else {
          lead.answers.contactTime = validContactTime(message) ? message : "No indicada";
          lead.step = "complete";
          lead.status = "qualified";
          lead.classification = classification(lead.answers);
          reply = "Perfecto. Osorio continuará contigo personalmente.";
        }
        break;
      default:
        lead.step = "interest";
        reply = QUESTIONS.interest;
    }

    await saveLead(lead);
    const completed = lead.status === "qualified";
    return {
      replies: [reply],
      lead,
      completed,
      summary: completed ? summary(lead) : undefined
    };
  }

  return { handle, classification, summary, QUESTIONS };
}

module.exports = { createAgent, classification, summary, validContactTime, QUESTIONS };
