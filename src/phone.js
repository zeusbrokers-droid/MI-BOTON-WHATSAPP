"use strict";

// Formatting checks alone cannot distinguish a numeric WhatsApp LID from a phone.
// Only @c.us identities, resolved PN values or client-provided phones are used.
function normalizePhone(value) {
  const text = String(value || "").trim();
  if (!/^\+?[\d\s().-]+$/.test(text)) return "";
  let digits = text.replace(/\D/g, "");
  if (digits.length === 10) digits = `1${digits}`; // Leslie's US market
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : "";
}

function phoneFromId(value) {
  const match = String(value || "").match(/^(\d+)@c\.us$/);
  return match ? normalizePhone(match[1]) : "";
}

function leadPhone(lead) {
  const phone = normalizePhone(lead.phone);
  const lid = String(lead.id || "").match(/^(\d+)@lid$/)?.[1];
  return lid && String(lead.phone || "").replace(/\D/g, "") === lid ? "" : phone;
}

async function resolveContactPhone(client, chatId, contact = {}) {
  try {
    const [identity] = await client.getContactLidAndPhone([chatId]);
    const phone = phoneFromId(identity?.pn);
    if (phone) return phone;
  } catch {
    // Continue the conversation and collect the phone if resolution is unavailable.
  }
  return phoneFromId(chatId) || phoneFromId(contact.id?._serialized);
}

module.exports = { normalizePhone, phoneFromId, leadPhone, resolveContactPhone };
