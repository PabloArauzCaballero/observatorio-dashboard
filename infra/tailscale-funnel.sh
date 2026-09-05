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
# Se corre UNA vez, EN EL SERVIDOR. La configuracion queda guardada en el estado
# de tailscaled: sobrevive a reinicios del contenedor, del demonio y de la
# maquina, y no hay que repetirla en cada despliegue. Volver a correrlo no hace
# dano: reescribe la misma regla.
#
#   ssh pablo-h310 'sudo bash -s' < infra/tailscale-funnel.sh
#
# Para retirar la publicacion: `sudo tailscale funnel reset`.
#
# Ojo: lo que se abre es el tablero y solo el tablero. La API vecina, en el 3002,
# corre hoy con AUTH_MODE=disabled y no debe publicarse por aqui.
set -euo pipefail

PORT="${WEB_PUBLISH_PORT:-3003}"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "tailscale no esta instalado en este servidor" >&2
  exit 1
fi

# El contenedor publica en loopback justamente para esto. Si no responde ahi, se
# prueba la interfaz de la tailnet, que es la otra publicacion del compose: un
# contenedor levantado antes de que el compose trajera el bind de loopback solo
# esta en esa. Sin ninguna de las dos, el tunel apuntaria a un puerto muerto y
# serviria un 502 publico, asi que se falla aqui y no despues.
target=""
for candidate in "127.0.0.1:${PORT}" "100.101.207.88:${PORT}"; do
  if curl --silent --fail --max-time 15 --output /dev/null "http://${candidate}/"; then
    target="$candidate"
    break
  fi
done

if [ -z "$target" ]; then
  echo "nadie responde en el puerto ${PORT}: despliega el tablero antes de abrir el tunel" >&2
  exit 1
fi

echo "destino del tunel: http://${target}"

# Funnel exige que la tailnet tenga HTTPS habilitado y el atributo `funnel`
# concedido al nodo. Si falta alguno, tailscale lo dice aqui y no mas adelante.
tailscale funnel --bg "http://${target}"

echo
tailscale funnel status
