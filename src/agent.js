"use strict";

const DIRECT_HANDOFF = /\b(hablar|contactar|llamar|comunicar|leslie|persona|humano|asesor[a]?)\b/i;
const PRICE = /\b(precio|cu[aá]nto cuesta|costo|mensualidad|pago mensual|cotizaci[oó]n)\b/i;
const INVENTORY = /\b(disponible|disponibilidad|inventario|tienen|hay un|queda)\b/i;
const PROMOTION = /\b(promoci[oó]n|descuento|oferta|rebaja|especial)\b/i;
const APPROVAL = /\b(aprobado|aprobar|califico|calificar|me aprueban|financiamiento espec[ií]fico)\b/i;

const QUESTIONS = {
  intent: "¡Hola! Gracias por escribir a Leslie Car Miami 🚗. ¿Buscas un auto en específico o te gustaría ver las opciones disponibles?",
  vehicle: "¿Qué marca, modelo o tipo de auto estás buscando?",
  vehicleType: "Claro 👍 ¿Prefieres SUV, sedán o pickup?",
  budget: "¿Qué presupuesto aproximado tienes pensado para el vehículo?",
  payment: "¿Planeas comprarlo financiado o al contado?",
  credit: "Perfecto 👍 ¿Cómo consideras tu crédito actualmente: excelente, bueno, regular o estás reconstruyéndolo?",
  downPayment: "¿Con cuánto enganche o inicial cuentas aproximadamente?",
  idType: "Sin compartir ningún número: ¿cuentas con Social Security o ITIN?",
  license: "¿Tienes licencia de conducir de EE. UU. o pasaporte vigente?",
  urgency: "¿Cuándo tienes pensado comprar: hoy, esta semana o este mes?",
  tradeIn: "¿Tienes algún auto actual que quieras entregar como parte de pago?",
  tradeVehicle: "Perfecto 👍 ¿Qué año, marca y modelo es?",
  contactTime: "¡Perfecto! Ya tengo lo necesario para que Leslie pueda orientarte. ¿A qué hora te queda mejor que te contacte hoy?"
};

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function yes(text) {
  return /^(s[ií]|si tengo|tengo|claro|correcto|yes)\b/i.test(clean(text));
}

function no(text) {
  return /^(no|ninguno|ninguna|no tengo|not)\b/i.test(clean(text));
}

function normalizePayment(text) {
  if (/financ/i.test(text)) return "Financiado";
  if (/contado|cash/i.test(text)) return "Cash";
  return clean(text);
}

function normalizeUrgency(text) {
  if (/hoy|ahora|inmediat/i.test(text)) return "Hoy";
  if (/semana|d[ií]as/i.test(text)) return "Esta semana";
  if (/mes/i.test(text)) return "Este mes";
  if (/explor|mirando|sin fecha|no s[eé]/i.test(text)) return "Sin fecha";
  return clean(text);
}

function validContactTime(text) {
  const value = clean(text);
  if (!value) return false;
  return /\b(?:a\s+las\s+)?(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?)?\b/i.test(value)
    || /\b(mañana|tarde|noche|mediod[ií]a|ahora|cualquier hora|cuando pueda|despu[eé]s de|antes de)\b/i.test(value);
}

function sourceFrom(text, fallback = "WhatsApp directo") {
  const value = clean(text);
  const tagged = value.match(/(?:fuente|source)\s*:\s*([^\n]+)/i);
  if (tagged) return clean(tagged[1]);
  if (/tiktok/i.test(value)) return "TikTok";
  if (/instagram|\big\b/i.test(value)) return "Instagram";
  if (/facebook|\bfb\b/i.test(value)) return "Facebook";
  if (/google/i.test(value)) return "Google";
  if (/referid|recomend/i.test(value)) return "Referido";
  return fallback;
}

function classification(answers) {
  const hasVehicle = Boolean(answers.vehicle && !/no s[eé]|no definido/i.test(answers.vehicle));
  const hasBudget = Boolean(answers.budget && !/no s[eé]|no indicado/i.test(answers.budget));
  const hasInitial = Boolean(answers.downPayment && !/no s[eé]|no indicado/i.test(answers.downPayment));
  const urgent = answers.urgency === "Hoy" || answers.urgency === "Esta semana";
  const explicitInterest = Boolean(answers.intent && /precio|disponib|promoci|oferta|carro|auto|veh[ií]culo/i.test(answers.intent));
  const hasContactTime = validContactTime(answers.contactTime);

  if (urgent && hasVehicle && (hasBudget || hasInitial) && hasContactTime) {
    return {
      code: "hot",
      label: "🔥 Caliente",
      reason: "Tiene vehículo definido, presupuesto o inicial, urgencia cercana y horario de contacto."
    };
  }
  if (["Esta semana", "Este mes"].includes(answers.urgency) || hasVehicle || hasBudget || answers.payment === "Financiado") {
    return {
      code: "warm",
      label: "🟡 Tibio",
      reason: "Muestra interés, pero aún está comparando o definiendo parte del proceso."
    };
  }
  if (explicitInterest && hasContactTime) {
    return {
      code: "warm",
      label: "🟡 Tibio",
      reason: "Solicitó información y dejó un horario de contacto, pero faltan datos para confirmar urgencia y presupuesto."
    };
  }
  return {
    code: "cold",
    label: "❄️ Frío",
    reason: "No indicó fecha, vehículo o presupuesto suficientes para avanzar ahora."
  };
}

function summary(lead) {
  const a = lead.answers;
  const c = lead.classification || classification(a);
  return [
    "📌 NUEVO PROSPECTO",
    `Clasificación: ${c.label}`,
    `Cliente: ${lead.name || "No indicado"}`,
    `Teléfono: ${lead.phone || "No indicado"}`,
    `Fuente: ${lead.source || "No indicada"}`,
    `Busca: ${a.vehicle || "No indicado"}`,
    `Presupuesto: ${a.budget || "No indicado"}`,
    `Pago: ${a.payment || "No indicado"}`,
    `Crédito declarado: ${a.credit || "No aplica / No indicado"}`,
    `Inicial: ${a.downPayment || "No aplica / No indicado"}`,
    `Identificación: ${a.idType || "No indicado"}`,
    `Licencia/Pasaporte: ${a.license || "No indicado"}`,
    `Trade-in: ${a.tradeIn || "No indicado"}${a.tradeVehicle ? ` — ${a.tradeVehicle}` : ""}`,
    `Urgencia: ${a.urgency || "Sin fecha"}`,
    `Siguiente paso: Llamar`,
    `Hora solicitada: ${a.contactTime || "No indicada"}`,
    `Motivo: ${c.reason}`
  ].join("\n");
}

function parseImportedLead(text, base) {
  if (!/NUEVO PROSPECTO (?:DE LESLIE CAR MIAMI|DE TIKTOK)/i.test(text)) return null;
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) values[clean(match[1]).toLowerCase()] = clean(match[2]);
  }
  const answers = {
    vehicle: values.busca || values["tipo de vehículo"],
    budget: values.presupuesto,
    payment: values.pago,
    credit: values["crédito declarado"] || values["crédito"],
    downPayment: values.inicial,
    idType: values["identificación"],
    license: values["licencia/pasaporte"],
    tradeIn: values["trade-in"],
    urgency: values.urgencia,
    contactTime: values["hora solicitada"]
  };
  const lead = {
    ...base,
    name: values.cliente || base.name,
    phone: values["teléfono"] || base.phone,
    source: values.fuente || sourceFrom(text, base.source),
    answers,
    step: "complete",
    status: "qualified",
    updatedAt: new Date().toISOString()
  };
  lead.classification = classification(answers);
  return lead;
}

function createAgent({ loadLead, saveLead }) {
  if (typeof loadLead !== "function" || typeof saveLead !== "function") {
    throw new TypeError("createAgent requiere loadLead y saveLead");
  }

  async function handle({ chatId, text, profileName = "", phone = "", source = "" }) {
    const message = clean(text);
    if (!message) return { replies: [] };

    const existing = await loadLead(chatId);
    const base = existing || {
      id: chatId,
      name: clean(profileName),
      phone: clean(phone) || clean(chatId).replace(/@.+$/, ""),
      source: sourceFrom(message, source || "WhatsApp directo"),
      answers: {},
      step: "intent",
      status: "new",
      createdAt: new Date().toISOString()
    };

    const imported = parseImportedLead(message, base);
    if (imported) {
      await saveLead(imported);
      return {
        replies: ["¡Perfecto! Recibimos tu información 👍 Leslie podrá revisarla y contactarte en el horario indicado."],
        lead: imported,
        completed: true,
        summary: summary(imported)
      };
    }

    if (/^(reiniciar|empezar de nuevo|restart)$/i.test(message)) {
      const restarted = { ...base, answers: {}, step: "intent", status: "new", updatedAt: new Date().toISOString() };
      await saveLead(restarted);
      return { replies: [QUESTIONS.intent], lead: restarted };
    }

    if (base.status === "qualified" || base.status === "handoff") {
      return { replies: ["Gracias 👍 Leslie continuará contigo personalmente."], lead: base, handoff: true };
    }

    if (PRICE.test(message)) {
      const routed = { ...base, answers: { ...base.answers, intent: message }, step: "contactTime", updatedAt: new Date().toISOString() };
      await saveLead(routed);
      return { replies: ["Leslie te puede confirmar ese dato directamente para darte la información correcta. ¿A qué hora te queda mejor que te contacte?"], lead: routed };
    }
    if (INVENTORY.test(message)) {
      const routed = { ...base, answers: { ...base.answers, intent: message }, step: "contactTime", updatedAt: new Date().toISOString() };
      await saveLead(routed);
      return { replies: ["Leslie puede confirmar la disponibilidad directamente. ¿A qué hora te queda mejor que te contacte?"], lead: routed };
    }
    if (PROMOTION.test(message)) {
      const routed = { ...base, answers: { ...base.answers, intent: message }, step: "contactTime", updatedAt: new Date().toISOString() };
      await saveLead(routed);
      return { replies: ["Leslie puede confirmarte las promociones y condiciones disponibles. ¿A qué hora te queda mejor que te contacte?"], lead: routed };
    }
    if (APPROVAL.test(message)) {
      return { replies: ["Leslie puede revisar tu situación y orientarte sobre las opciones disponibles."], lead: base };
    }
    if (DIRECT_HANDOFF.test(message) && /ahora|direct|inmediat|persona|humano/i.test(message)) {
      const handed = { ...base, status: "handoff", updatedAt: new Date().toISOString() };
      await saveLead(handed);
      return {
        replies: ["Claro 👍 Puedes comunicarte directamente con Leslie al +1 786-451-3280."],
        lead: handed,
        handoff: true
      };
    }

    const lead = { ...base, answers: { ...base.answers }, updatedAt: new Date().toISOString() };
    let reply;

    switch (lead.step) {
      case "intent":
        if (!existing) {
          reply = QUESTIONS.intent;
        } else {
          lead.answers.intent = message;
          lead.step = /opci|no s[eé]|mirando/i.test(message) ? "vehicleType" : "vehicle";
          reply = lead.step === "vehicleType" ? QUESTIONS.vehicleType : QUESTIONS.vehicle;
        }
        break;
      case "vehicleType":
      case "vehicle":
        lead.answers.vehicle = message;
        lead.step = "budget";
        reply = QUESTIONS.budget;
        break;
      case "budget":
        lead.answers.budget = message;
        lead.step = "payment";
        reply = QUESTIONS.payment;
        break;
      case "payment":
        lead.answers.payment = normalizePayment(message);
        lead.step = lead.answers.payment === "Financiado" ? "credit" : "idType";
        reply = lead.step === "credit" ? QUESTIONS.credit : QUESTIONS.idType;
        break;
      case "credit":
        lead.answers.credit = message;
        lead.step = "downPayment";
        reply = QUESTIONS.downPayment;
        break;
      case "downPayment":
        lead.answers.downPayment = message;
        lead.step = "idType";
        reply = QUESTIONS.idType;
        break;
      case "idType":
        lead.answers.idType = message;
        lead.step = "license";
        reply = QUESTIONS.license;
        break;
      case "license":
        lead.answers.license = message;
        lead.step = "urgency";
        reply = QUESTIONS.urgency;
        break;
      case "urgency":
        lead.answers.urgency = normalizeUrgency(message);
        lead.step = "tradeIn";
        reply = QUESTIONS.tradeIn;
        break;
      case "tradeIn":
        lead.answers.tradeIn = yes(message) ? "Sí" : no(message) ? "No" : message;
        lead.step = lead.answers.tradeIn === "Sí" ? "tradeVehicle" : "contactTime";
        reply = lead.step === "tradeVehicle" ? QUESTIONS.tradeVehicle : QUESTIONS.contactTime;
        break;
      case "tradeVehicle":
        lead.answers.tradeVehicle = message;
        lead.step = "contactTime";
        reply = QUESTIONS.contactTime;
        break;
      case "contactTime":
        if (validContactTime(message)) {
          lead.answers.contactTime = message;
          lead.step = "complete";
          lead.status = "qualified";
          lead.classification = classification(lead.answers);
          reply = "Perfecto 👍 Le paso la información a Leslie para que pueda contactarte.";
        } else if (!lead.contactTimeRetry) {
          lead.contactTimeRetry = 1;
          reply = "Para coordinar con Leslie, dime una hora aproximada, por ejemplo: 3 pm, después de las 5 o en la mañana.";
        } else {
          lead.answers.contactTime = "No indicada";
          lead.step = "complete";
          lead.status = "qualified";
          lead.classification = classification(lead.answers);
          reply = "Entendido 👍 Le pasaré tu información a Leslie para que continúe contigo. También puedes llamarla al +1 786-451-3280.";
        }
        break;
      default:
        lead.step = "intent";
        reply = QUESTIONS.intent;
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

  return { handle, classification, summary };
}

module.exports = { createAgent, classification, summary, sourceFrom, parseImportedLead, validContactTime, QUESTIONS };
