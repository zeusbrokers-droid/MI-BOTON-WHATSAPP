#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Falta instalar Node.js 18 o superior."
  read -r -p "Presiona Enter para cerrar."
  exit 1
fi
if [ ! -d node_modules ]; then npm install || exit 1; fi
open http://127.0.0.1:8787
npm start
