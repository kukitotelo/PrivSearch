#!/usr/bin/env bash
# ============================================================
# PrivSearch – Application Startup Script
# Platform: Linux / Kali
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "    Iniciando PrivSearch Browser..."
echo "=========================================="

if [ ! -d "node_modules" ]; then
  echo "[*] Instalando dependencias de Node..."
  npm install
fi

echo "[*] Compilando TypeScript y copiando esquemas..."
npm run build

echo "[*] Verificando esquema SQLite..."
if [ ! -f "dist/db/schema.sql" ]; then
  echo "[!] Error: dist/db/schema.sql no fue copiado correctamente."
  exit 1
fi

echo "[*] Lanzando PrivSearch (Electron)..."
# In Kali / Linux environments, pass --no-sandbox only if running under root or container
EXTRA_FLAGS=""
if [ "$EUID" -eq 0 ]; then
  EXTRA_FLAGS="--no-sandbox"
fi

npx electron dist/main/index.js $EXTRA_FLAGS "$@"
