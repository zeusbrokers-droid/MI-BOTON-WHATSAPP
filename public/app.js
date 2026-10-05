const statusNode=document.querySelector("#status");
const connectionText=document.querySelector("#connectionText");
const qr=document.querySelector("#qr");
const pairingForm=document.querySelector("#pairingForm");
const pairingButton=document.querySelector("#pairingButton");
const pairingResult=document.querySelector("#pairingResult");
const pairingCode=document.querySelector("#pairingCode");
const leadsNode=document.querySelector("#leads");
const contentForm=document.querySelector("#contentForm");
const contentMedia=document.querySelector("#contentMedia");
const mediaPreview=document.querySelector("#mediaPreview");
const instagramCopy=document.querySelector("#instagramCopy");
const tiktokCopy=document.querySelector("#tiktokCopy");
const CONTENT_KEY="leslie-content-draft-v1";
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

function draftValues(){return{vehicle:document.querySelector("#contentVehicle").value.trim(),detail:document.querySelector("#contentDetail").value.trim(),cta:document.querySelector("#contentCta").value.trim(),instagram:instagramCopy.value,tiktok:tiktokCopy.value}}
function saveDraft(){localStorage.setItem(CONTENT_KEY,JSON.stringify(draftValues()))}
function restoreDraft(){try{const draft=JSON.parse(localStorage.getItem(CONTENT_KEY)||"null");if(!draft)return;document.querySelector("#contentVehicle").value=draft.vehicle||"";document.querySelector("#contentDetail").value=draft.detail||"";document.querySelector("#contentCta").value=draft.cta||"Escríbenos por WhatsApp al 786-451-3280 para recibir información.";instagramCopy.value=draft.instagram||"";tiktokCopy.value=draft.tiktok||""}catch{localStorage.removeItem(CONTENT_KEY)}}
function normalizedTags(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9 ]/g," ").split(/\s+/).filter(word=>word.length>2).slice(0,3).map(word=>`#${word}`).join(" ")}
function createCopies(){const {vehicle,detail,cta}=draftValues();const subject=vehicle||"¿Buscas tu próximo auto?";const description=detail||"Te ayudamos a encontrar una opción que se ajuste a lo que necesitas.";const action=cta||"Escríbenos por WhatsApp al 786-451-3280 para recibir información.";const customTags=normalizedTags(vehicle);instagramCopy.value=[`🚗 ${subject}`,"",description,"",action,"",["#LeslieCarMiami","#AutosMiami","#MiamiCars",customTags].filter(Boolean).join(" ")].join("\n");tiktokCopy.value=[`🚗 ${subject}`,description,action,["#LeslieCarMiami","#AutosMiami",customTags].filter(Boolean).join(" ")].join("\n");saveDraft()}
contentForm.addEventListener("submit",event=>{event.preventDefault();createCopies();document.querySelector("#contentResults").scrollIntoView({behavior:"smooth",block:"nearest"})});
contentForm.addEventListener("input",event=>{if(event.target!==contentMedia)saveDraft()});
contentMedia.addEventListener("change",()=>{const file=contentMedia.files?.[0];mediaPreview.innerHTML="";if(!file){mediaPreview.innerHTML="<span>Selecciona una foto o video.</span>";return}const url=URL.createObjectURL(file);const element=document.createElement(file.type.startsWith("video/")?"video":"img");element.src=url;element.alt="Vista previa del contenido";if(element.tagName==="VIDEO")element.controls=true;element.addEventListener("load",()=>URL.revokeObjectURL(url),{once:true});element.addEventListener("loadedmetadata",()=>URL.revokeObjectURL(url),{once:true});mediaPreview.appendChild(element)});
document.querySelectorAll("[data-copy]").forEach(button=>button.addEventListener("click",async()=>{const target=button.dataset.copy==="tiktok"?tiktokCopy:instagramCopy;if(!target.value)return;await navigator.clipboard.writeText(target.value);button.textContent="Copiado";button.classList.add("copied");setTimeout(()=>{button.textContent="Copiar texto";button.classList.remove("copied")},1600)}));
document.querySelector("#clearContent").addEventListener("click",()=>{contentForm.reset();document.querySelector("#contentCta").value="Escríbenos por WhatsApp al 786-451-3280 para recibir información.";instagramCopy.value="";tiktokCopy.value="";mediaPreview.innerHTML="<span>Selecciona una foto o video.</span>";localStorage.removeItem(CONTENT_KEY)});
restoreDraft();
refresh();setInterval(refresh,5000);
