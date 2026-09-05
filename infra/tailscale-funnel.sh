#!/usr/bin/env bash
# Publica el tablero en internet con una URL fija, desde el servidor pablo-h310.
#
# Coolify asigna hoy un dominio `*.localhost.sslip.io` que no resuelve para
# nadie, y el servidor no tiene puertos abiertos hacia afuera. Tailscale Funnel
# resuelve las dos cosas a la vez: termina TLS con el certificado del nodo y
# entrega el trafico por la conexion que el propio servidor ya mantiene, sin
# abrir un puerto en el router ni depender de una IP domestica que cambia.
#
#   https://pablo-h310.taila8f993.ts.net:8443  ->  100.101.207.88:3003
#
# DOS DECISIONES QUE PARECEN RARAS Y NO LO SON:
#
# 1) El destino es la direccion de Tailscale del servidor, no `127.0.0.1`.
#    El 3003 de loopback pertenece a AloVida, otro proyecto que vive en esta
#    misma maquina. Son interfaces distintas y por eso ambos usan el 3003 sin
#    estorbarse, pero un tunel a loopback sirve AloVida, no el Observatorio.
#
# 2) El puerto publico es el 8443 y no el 443. El 443 de este nodo ya lo ocupa
#    AloVida en `/` y en `/webhook/front`; tomarlo dejaria a ese proyecto sin su
#    direccion. Funnel admite 443, 8443 y 10000, asi que el tablero se queda con
#    el 8443 y nadie pierde nada.
#
# Se corre UNA vez, EN EL SERVIDOR. La configuracion queda guardada en el estado
# de tailscaled: sobrevive a reinicios del contenedor, del demonio y de la
# maquina, y no hay que repetirla en cada despliegue. Volver a correrlo no hace
# dano: reescribe la misma regla.
#
#   ssh pablo-h310 'sudo bash -s' < infra/tailscale-funnel.sh
#
# Para retirar SOLO esta publicacion, sin tocar la de AloVida:
#   sudo tailscale funnel --https=8443 off
#
# Ojo: lo que se abre es el tablero y solo el tablero. La API vecina, en el 3002,
# corre hoy con AUTH_MODE=disabled sobre los datos reales y no debe publicarse.
set -euo pipefail

HOST="${WEB_PUBLISH_ADDRESS:-100.101.207.88}"
PORT="${WEB_PUBLISH_PORT:-3003}"
PUBLIC_PORT="${FUNNEL_PORT:-8443}"
TARGET="http://${HOST}:${PORT}"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "tailscale no esta instalado en este servidor" >&2
  exit 1
fi

# No basta con que algo responda en el puerto: el error que este guion existe
# para no repetir fue precisamente abrir un tunel hacia el vecino equivocado.
# `/api/version` solo la sirve el tablero, asi que identifica lo que hay detras.
if ! curl --silent --fail --max-time 15 "${TARGET}/api/version" | grep -q startedAt; then
  echo "en ${TARGET} no responde el tablero del Observatorio." >&2
  echo "Despliegalo antes de abrir el tunel, o comprueba que no sea otro" >&2
  echo "proyecto el que ocupa ese puerto." >&2
  exit 1
fi

echo "destino verificado: ${TARGET} sirve el Observatorio"

# Funnel exige que la tailnet tenga HTTPS habilitado y el atributo `funnel`
# concedido al nodo. Si falta alguno, tailscale lo dice aqui y no mas adelante.
tailscale funnel --bg --https="${PUBLIC_PORT}" "${TARGET}"

echo
tailscale funnel status
