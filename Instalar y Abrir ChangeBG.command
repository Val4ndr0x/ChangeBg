#!/bin/bash
# Instala (solo la primera vez) y abre ChangeBG en el navegador.
# Hecho para hacer doble click, sin necesidad de saber de programacion.

cd "$(cd "$(dirname "$0")" && pwd)" || exit 1

PORT=3000
URL="http://localhost:$PORT"

fail() {
  echo ""
  echo "X Ocurrio un problema: $1"
  echo ""
  read -p "Presiona Enter para cerrar esta ventana..." _
  exit 1
}

echo "=================================================="
echo " ChangeBG - instalando / abriendo"
echo "=================================================="
echo ""

# Si ya esta corriendo, solo abrir el navegador y salir
if command -v lsof >/dev/null 2>&1 && lsof -i ":$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "ChangeBG ya esta corriendo. Abriendo el navegador..."
  open "$URL"
  exit 0
fi

# 1) Homebrew (gestor de paquetes de Mac)
if ! command -v brew >/dev/null 2>&1; then
  echo "Instalando Homebrew (una sola vez, puede tardar varios minutos)..."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
    || fail "No se pudo instalar Homebrew. Revisa tu conexion a internet e intenta de nuevo."
fi

if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

# 2) Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "Instalando Node.js (una sola vez)..."
  brew install node || fail "No se pudo instalar Node.js."
fi

echo "Usando Node $(node -v)"
echo ""

# 3) Dependencias del proyecto
echo "Instalando dependencias del proyecto (puede tardar unos minutos la primera vez)..."
npm install || fail "Fallo 'npm install'. Si el error menciona compilacion, ejecuta en Terminal: xcode-select --install"

# 4) Modelos de IA (recorte de persona / deteccion de rostro)
if [ ! -s "server/models/birefnet.onnx" ] || [ ! -s "server/models/face_detection_yunet.onnx" ]; then
  echo ""
  echo "Descargando modelos de IA (~220MB, solo la primera vez)..."
  npm run download-model || fail "No se pudieron descargar los modelos de IA. Revisa tu conexion a internet."
fi

# 5) Recursos graficos por defecto
if [ ! -f "public/backgrounds/default-black.jpg" ] || [ ! -f "public/frames/frame.png" ]; then
  echo ""
  echo "Generando recursos graficos..."
  npm run generate-assets || fail "No se pudieron generar los recursos graficos."
fi

# 6) Compilar la app (solo si no existe una compilacion o se borro)
if [ ! -f ".output/server/index.mjs" ]; then
  echo ""
  echo "Compilando la aplicacion (solo la primera vez o despues de una actualizacion)..."
  npm run build || fail "Fallo la compilacion de la aplicacion."
fi

# 7) Arrancar el servidor y abrir el navegador
echo ""
echo "Iniciando ChangeBG..."
PORT=$PORT node .output/server/index.mjs &
SERVER_PID=$!

cleanup() {
  echo ""
  echo "Cerrando ChangeBG..."
  kill "$SERVER_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

READY=0
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "$URL"; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  fail "ChangeBG no respondio a tiempo. Cierra esta ventana e intenta de nuevo."
fi

open "$URL"

echo ""
echo "=================================================="
echo " ChangeBG esta funcionando en $URL"
echo " No cierres esta ventana mientras la estes usando."
echo " Para salir, cierra esta ventana o presiona Ctrl+C."
echo "=================================================="
echo ""

wait "$SERVER_PID"
