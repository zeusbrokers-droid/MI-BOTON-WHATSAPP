const statusNode=document.querySelector("#status");
const connectionText=document.querySelector("#connectionText");
const qr=document.querySelector("#qr");
const pairingForm=document.querySelector("#pairingForm");
const pairingButton=document.querySelector("#pairingButton");
const pairingResult=document.querySelector("#pairingResult");
const pairingCode=document.querySelector("#pairingCode");
const leadsNode=document.querySelector("#leads");
const conversationList=document.querySelector("#conversationList");
const conversationThread=document.querySelector("#conversationThread");
const installPanel=document.querySelector("#installPanel");
let currentLeads=[];
let selectedConversation="";
let installPrompt=null;
const escapeHtml=value=>String(value||"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const formatTime=value=>{try{return new Intl.DateTimeFormat("es-US",{dateStyle:"short",timeStyle:"short",timeZone:"America/New_York"}).format(new Date(value))}catch{return ""}};

function renderConversation(){
  const available=currentLeads.filter(lead=>Array.isArray(lead.conversation)&&lead.conversation.length);
  if(!available.length){
    conversationList.innerHTML='<p class="empty">Todavía no hay conversaciones.</p>';
    conversationThread.innerHTML='<p class="empty">Los mensajes nuevos aparecerán aquí automáticamente.</p>';
    return;
  }
  if(!selectedConversation||!available.some(lead=>lead.id===selectedConversation))selectedConversation=available[0].id;
  conversationList.innerHTML=available.map(lead=>`<button class="conversation-contact ${lead.id===selectedConversation?"active":""}" data-conversation="${encodeURIComponent(lead.id)}" type="button"><strong>${escapeHtml(lead.name||lead.phone||"Cliente")}</strong><span>${escapeHtml(lead.phone||"")}</span><small>${formatTime(lead.lastMessageAt||lead.updatedAt)}</small></button>`).join("");
  const lead=available.find(item=>item.id===selectedConversation);
  conversationThread.innerHTML=`<div class="thread-head"><div><strong>${escapeHtml(lead.name||lead.phone||"Cliente")}</strong><span>${escapeHtml(lead.phone||"")}</span></div><span class="badge">${escapeHtml(lead.classification?.label||"En proceso")}</span></div><div class="messages">${lead.conversation.map(message=>`<article class="message ${message.direction==="outbound"?"outbound":"inbound"}"><small>${escapeHtml(message.author||(message.direction==="outbound"?"Agente Osorio":"Cliente"))}</small><p>${escapeHtml(message.text)}</p><time>${formatTime(message.timestamp)}</time></article>`).join("")}</div>`;
  const messages=conversationThread.querySelector(".messages");
  if(messages)messages.scrollTop=messages.scrollHeight;
}

async function loadStatus(){
  const response=await fetch("/api/status");
  if(response.status===401){location.replace("/login");return}
  const status=await response.json();
  const labels={starting:"Iniciando",waiting_qr:"Listo para vincular",requesting_code:"Generando código",waiting_code:"Introduce el código",authenticated:"Conectando",ready:"Agente activo",disabled:"Desactivado",auth_failure:"Error de acceso",disconnected:"Desconectado",error:"Error"};
  statusNode.textContent=labels[status.status]||status.status;
  statusNode.classList.toggle("ready",status.status==="ready");
  pairingForm.hidden=status.status==="ready"||status.status==="authenticated";
  pairingResult.hidden=!status.pairingCode;
  pairingCode.textContent=status.pairingCode?String(status.pairingCode).replace(/(.{4})/g,"$1 ").trim():"";
  if(status.status==="waiting_qr"&&status.qrDataUrl){
    connectionText.textContent="Escanea el QR desde WhatsApp Business → Dispositivos vinculados.";
    qr.src=status.qrDataUrl;qr.hidden=false;
  }else{
    qr.hidden=true;
    connectionText.textContent=status.status==="ready"?"WhatsApp Business conectado. El agente responde mensajes nuevos y registra prospectos.":status.status==="waiting_code"?"Introduce el código en el teléfono de Osorio.":status.error?`No se pudo conectar: ${status.error}`:"Preparando la conexión…";
  }
}

pairingForm.addEventListener("submit",async event=>{
  event.preventDefault();pairingButton.disabled=true;pairingButton.textContent="Generando…";
  try{
    const response=await fetch("/api/pairing-code",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({phoneNumber:document.querySelector("#phoneNumber").value})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"No se pudo generar el código.");
    pairingCode.textContent=String(result.code).replace(/(.{4})/g,"$1 ").trim();
    pairingResult.hidden=false;
    await loadStatus();
  }catch(error){connectionText.textContent=error.message}
  finally{pairingButton.disabled=false;pairingButton.textContent="Generar código"}
});

async function loadLeads(){
  const response=await fetch("/api/leads");
  if(response.status===401){location.replace("/login");return}
  const {leads}=await response.json();
  currentLeads=leads;
  const active=leads.filter(lead=>lead.status!=="blocked_minor");
  const counts={hot:0,warm:0,cold:0};
  for(const lead of active)if(lead.classification?.code)counts[lead.classification.code]++;
  document.querySelector("#total").textContent=active.length;
  Object.entries(counts).forEach(([key,value])=>document.querySelector(`#${key}`).textContent=value);
  leadsNode.innerHTML=active.length?active.map(lead=>`<tr><td><strong>${escapeHtml(lead.name||lead.phone||"Sin nombre")}</strong><br><small>${escapeHtml(lead.phone||"")}</small></td><td><span class="badge">${escapeHtml(lead.classification?.label||"En proceso")}</span></td><td>${escapeHtml(lead.answers?.interest||"—")}</td><td>${escapeHtml(lead.answers?.quantity||"—")}</td><td>${escapeHtml(lead.answers?.location||"—")}</td><td>${escapeHtml(lead.answers?.contactTime||"—")}</td></tr>`).join(""):'<tr><td colspan="6" class="empty">Todavía no hay prospectos.</td></tr>';
  renderConversation();
}

async function refresh(){try{await Promise.all([loadStatus(),loadLeads()])}catch{statusNode.textContent="Sin conexión"}}
document.querySelector("#refresh").addEventListener("click",refresh);
conversationList.addEventListener("click",event=>{const button=event.target.closest("[data-conversation]");if(!button)return;selectedConversation=decodeURIComponent(button.dataset.conversation);renderConversation()});
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;installPanel.hidden=false});
installPanel.hidden=true;
installPanel.addEventListener("click",async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;installPanel.hidden=true;return}alert("En iPhone o iPad: abre Compartir y selecciona ‘Añadir a pantalla de inicio’.")});
if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
refresh();setInterval(refresh,5000);
