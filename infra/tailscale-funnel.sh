#!/usr/bin/env bash
# Publica el tablero en internet con una URL fija, desde el servidor pablo-h310.
#
# Coolify asigna hoy un dominio `*.localhost.sslip.io` que no resuelve para
# nadie, y el servidor no tiene puertos abiertos hacia afuera. Tailscale Funnel
# resuelve las dos cosas a la vez: termina TLS con el certificado del nodo y
# entrega el trafico por la conexion que el propio servidor ya mantiene, sin
# abrir un puerto en el router ni depender de una IP domestica que cambia.
#
#   https://pablo-h310.taila8f993.ts.net  ->  127.0.0.1:3003  ->  contenedor web
#
# Se corre UNA vez, en el servidor. La configuracion queda guardada en el estado
# de tailscaled: sobrevive a reinicios del contenedor, del demonio y de la
# maquina, y no hay que repetirla en cada despliegue. Volver a correrlo no hace
# dano: reescribe la misma regla.
#
#   ssh pablo-h310 'bash -s' < infra/tailscale-funnel.sh
#
# Para retirar la publicacion: `sudo tailscale funnel reset`.
set -euo pipefail

PORT="${WEB_PUBLISH_PORT:-3003}"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "tailscale no esta instalado en este servidor" >&2
  exit 1
fi

# El contenedor publica en loopback justamente para esto; si no responde, el
# tunel quedaria apuntando a un puerto muerto y serviria un 502 publico.
if ! curl --silent --fail --max-time 10 --output /dev/null "http://127.0.0.1:${PORT}/"; then
  echo "nadie responde en 127.0.0.1:${PORT}: despliega el tablero antes de abrir el tunel" >&2
  exit 1
fi

# Funnel exige que la tailnet tenga HTTPS habilitado y el atributo `funnel`
# concedido al nodo. Si falta alguno, tailscale lo dice aqui y no mas adelante.
sudo tailscale funnel --bg "${PORT}"

echo
sudo tailscale funnel status
