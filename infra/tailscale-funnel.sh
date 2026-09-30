#!/usr/bin/env bash
# Publica el tablero en internet con una URL fija, desde el servidor pablo-h310.
#
#   https://pablo-h310.taila8f993.ts.net:10000  ->  100.101.207.88:3003
#
# Este servidor hospeda mas de un proyecto y eso condiciona las dos elecciones
# que de otro modo pareceran arbitrarias:
#
# 1) El destino es la direccion de Tailscale del servidor, NO `127.0.0.1`.
#    El 3003 de loopback pertenece a AloVida. Son interfaces distintas y por eso
#    ambos proyectos usan el 3003 sin estorbarse, pero un tunel a loopback sirve
#    AloVida y no el Observatorio.
#
# 2) El puerto publico es el 10000. Funnel solo admite 443, 8443 y 10000, y en
#    este nodo el 443 ya lo ocupa el frontend de AloVida y el 8443 su backend.
#    El 10000 es el que queda libre.
#
# Se corre UNA vez, EN EL SERVIDOR. La configuracion queda en el estado de
# tailscaled: sobrevive a reinicios del contenedor, del demonio y de la maquina.
# Volver a correrlo no hace dano: reescribe la misma regla.
#
#   ssh pablo-h310 'sudo bash -s' < infra/tailscale-funnel.sh
#
# Para retirar SOLO esta publicacion:
#   sudo tailscale funnel --https=10000 off
#
# Ojo: se abre el tablero y solo el tablero. La API del observatorio, en el 3002,
# corre hoy con AUTH_MODE=disabled sobre los datos reales y no debe publicarse.
set -euo pipefail

HOST="${WEB_PUBLISH_ADDRESS:-100.101.207.88}"
PORT="${WEB_PUBLISH_PORT:-3003}"
PUBLIC_PORT="${FUNNEL_PORT:-10000}"
TARGET="http://${HOST}:${PORT}"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "tailscale no esta instalado en este servidor" >&2
  exit 1
fi

# Que algo responda en un puerto no dice QUE responde, y esa confusion ya mando
# una vez este tunel al proyecto vecino. `/api/version` solo la sirve el tablero.
if ! curl --silent --fail --max-time 15 "${TARGET}/api/version" | grep -q startedAt; then
  echo "en ${TARGET} no responde el tablero del Observatorio." >&2
  echo "Despliegalo antes de abrir el tunel, o comprueba que no sea otro" >&2
  echo "proyecto el que ocupa ese puerto." >&2
  exit 1
fi
echo "destino verificado: ${TARGET} sirve el Observatorio"

# Y antes de tomar un puerto publico, mirar si ya es de alguien. Tomarlo a ciegas
# dejaria sin direccion a otro proyecto de este mismo servidor, que es
# exactamente el accidente que este bloque existe para no repetir.
ocupado=$(tailscale funnel status 2>/dev/null | grep -F ":${PUBLIC_PORT}" || true)
if [ -n "$ocupado" ] && ! printf '%s' "$ocupado" | grep -qF "$TARGET"; then
  echo "el puerto ${PUBLIC_PORT} ya publica otra cosa:" >&2
  tailscale funnel status >&2
  echo >&2
  echo "Elige otro con FUNNEL_PORT=443|8443|10000, o retira esa regla a mano." >&2
  exit 1
fi

# Funnel exige que la tailnet tenga HTTPS habilitado y el atributo `funnel`
# concedido al nodo. Si falta alguno, tailscale lo dice aqui y no mas adelante.
tailscale funnel --bg --https="${PUBLIC_PORT}" "${TARGET}"

echo
tailscale funnel status
