"use strict";

const path = require("node:path");
const { app, BrowserWindow, dialog } = require("electron");
const { startServer } = require("./server");

let window;
let runtime;

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

function showWindow() {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

app.on("second-instance", showWindow);

app.whenReady().then(async () => {
  process.env.LESLIE_DATA_DIR = app.getPath("userData");
  try {
    runtime = await startServer();
    window = new BrowserWindow({
      width: 1240,
      height: 820,
      minWidth: 880,
      minHeight: 620,
      title: "Leslie Car Miami — Agente",
      icon: path.join(__dirname, "logo.png"),
      backgroundColor: "#070b12",
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    await window.loadURL(runtime.url);
    window.on("closed", () => { window = null; });
  } catch (error) {
    dialog.showErrorBox("Leslie Car Miami", `No se pudo iniciar el agente.\n\n${error.message}`);
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", event => {
  if (!runtime) return;
  event.preventDefault();
  const current = runtime;
  runtime = null;
  current.stop().finally(() => app.exit(0));
});
