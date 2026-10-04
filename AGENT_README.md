# Leslie Car Miami — agente de WhatsApp

Este componente convierte la calificación existente en un agente automático que escucha mensajes nuevos en WhatsApp Web, hace una pregunta a la vez, clasifica el prospecto y lo muestra en un panel local.

## Funciona sin IA pagada

El flujo es determinista y sigue las reglas comerciales aprobadas. No necesita OpenAI, Claude ni otra API de IA. Se conecta a la sesión de WhatsApp Web mediante un código QR y guarda los leads únicamente en la laptop.

## Instalación en Windows

1. Abrir `Leslie-Car-Agent-Setup.exe`.
2. Si Windows muestra protección SmartScreen, pulsar **Más información** y después **Ejecutar de todas formas**.
3. El instalador crea el acceso directo **Leslie Car Agent** y abre el panel automáticamente.
4. Escanear el QR con el WhatsApp Business de Leslie.

No es necesario instalar Node.js, usar una terminal ni conservar el ZIP técnico.

## Inicio para desarrollo

1. Instalar Google Chrome y Node.js 18 o posterior.
2. Ejecutar `npm install`.
3. Ejecutar `npm start`.
4. Abrir `http://127.0.0.1:8787`.
5. Escanear el QR con el WhatsApp de Leslie.

También puede iniciarse con doble clic en `Iniciar-Agente-Windows.bat` o `Iniciar-Agente-Mac.command`, según la laptop.

En la instalación local, la laptop debe permanecer encendida, conectada a internet y con el proceso activo para contestar.

El agente detecta automáticamente Google Chrome en Windows y macOS. Si Chrome está en otra ubicación, se puede indicar mediante `CHROME_PATH`.

## Railway (funciona con la laptop apagada)

El repositorio incluye `Dockerfile` y `railway.json`. Railway ejecuta Node.js y Chromium de forma continua.

Configuración obligatoria:

1. Crear un servicio desde este repositorio.
2. Añadir un volumen persistente montado en `/data`.
3. Configurar las variables:
   - `LESLIE_DATA_DIR=/data`
   - `PANEL_USER=leslie`
   - `PANEL_PASSWORD=` una contraseña larga y privada
   - `MANAGER_WHATSAPP_NUMBER=17864513280`
4. Generar el dominio público de Railway.
5. Abrir el panel, iniciar sesión y vincular WhatsApp mediante QR o código.

El endpoint `/api/health` queda público para el health check. El panel, el QR, el código de vinculación y los datos de prospectos quedan protegidos con autenticación HTTP.

## Fuentes

El agente detecta TikTok, Instagram, Facebook, Google, referidos y WhatsApp directo cuando el mensaje inicial menciona la fuente. Cualquier otro canal puede usar el mismo enlace o número de WhatsApp.

- TikTok: `https://lesliecarmiami.online/?src=tiktok`
- Instagram: `https://lesliecarmiami.online/?src=instagram`
- Facebook: `https://lesliecarmiami.online/?src=facebook`
- Google: `https://lesliecarmiami.online/?src=google`

## Límite importante

La conexión usa WhatsApp Web, no la API oficial de Meta. Es una integración local de bajo costo, pero depende de la sesión web y de cambios que WhatsApp pueda realizar. Para una operación empresarial con soporte y estabilidad garantizada se debe usar una integración oficial.
