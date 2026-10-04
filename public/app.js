const statusNode=document.querySelector("#status");
const connectionText=document.querySelector("#connectionText");
const qr=document.querySelector("#qr");
const pairingForm=document.querySelector("#pairingForm");
const pairingButton=document.querySelector("#pairingButton");
const pairingResult=document.querySelector("#pairingResult");
const pairingCode=document.querySelector("#pairingCode");
const leadsNode=document.querySelector("#leads");
const escapeHtml=value=>String(value||"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[char]);

async function loadStatus(){
  const status=await fetch("/api/status").then(result=>result.json());
  const labels={starting:"Iniciando",waiting_qr:"Listo para vincular",requesting_code:"Generando código",waiting_code:"Introduce el código",authenticated:"Conectando",ready:"Agente activo",disabled:"Modo de prueba",auth_failure:"Error de acceso",disconnected:"Desconectado",error:"Error"};
  statusNode.textContent=labels[status.status]||status.status;
  statusNode.classList.toggle("ready",status.status==="ready");
  pairingForm.hidden=status.status==="ready"||status.status==="authenticated";
  pairingResult.hidden=!status.pairingCode;
  pairingCode.textContent=status.pairingCode?String(status.pairingCode).replace(/(.{4})/g,"$1 ").trim():"";
  if(status.status==="waiting_qr"&&status.qrDataUrl){
    connectionText.textContent="En el teléfono de Leslie: WhatsApp → Dispositivos vinculados → Vincular dispositivo.";
    qr.src=status.qrDataUrl;qr.hidden=false;
  }else{
    qr.hidden=true;
    connectionText.textContent=status.status==="ready"?"WhatsApp conectado. El agente responde los mensajes nuevos y registra cada prospecto.":status.status==="waiting_code"?"Dile el código mostrado a Leslie para completar la vinculación.":status.status==="requesting_code"?"Generando un código válido…":status.status==="disabled"?"El panel funciona en modo de prueba; WhatsApp está desactivado.":status.error?`No se pudo conectar: ${status.error}`:"Preparando la conexión…";
  }
}

pairingForm.addEventListener("submit",async event=>{
  event.preventDefault();pairingButton.disabled=true;pairingButton.textContent="Generando…";
  try{
    const phoneNumber=document.querySelector("#phoneNumber").value;
    const response=await fetch("/api/pairing-code",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({phoneNumber})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"No se pudo generar el código.");
    pairingCode.textContent=String(result.code).replace(/(.{4})/g,"$1 ").trim();pairingResult.hidden=false;
    await loadStatus();
  }catch(error){connectionText.textContent=error.message}
  finally{pairingButton.disabled=false;pairingButton.textContent="Generar código"}
});

async function loadLeads(){
  const {leads}=await fetch("/api/leads").then(result=>result.json());
  const counts={hot:0,warm:0,cold:0};
  for(const lead of leads)if(lead.classification?.code)counts[lead.classification.code]++;
  document.querySelector("#total").textContent=leads.length;
  Object.entries(counts).forEach(([key,value])=>document.querySelector(`#${key}`).textContent=value);
  leadsNode.innerHTML=leads.length?leads.map(lead=>`<tr><td><strong>${escapeHtml(lead.name||lead.phone||"Sin nombre")}</strong><br><small>${escapeHtml(lead.phone||"")}</small></td><td><span class="badge">${escapeHtml(lead.classification?.label||"En proceso")}</span></td><td>${escapeHtml(lead.answers?.vehicle||"—")}</td><td>${escapeHtml(lead.source||"WhatsApp")}</td><td>${escapeHtml(lead.answers?.urgency||"—")}</td><td>${escapeHtml(lead.answers?.contactTime||"—")}</td></tr>`).join(""):"<tr><td colspan=\"6\" class=\"empty\">Todavía no hay prospectos.</td></tr>";
}

async function refresh(){try{await Promise.all([loadStatus(),loadLeads()])}catch(error){statusNode.textContent="Sin conexión"}}
document.querySelector("#refresh").addEventListener("click",refresh);
refresh();setInterval(refresh,5000);
