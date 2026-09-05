FROM node:22.16.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22.16.0-bookworm-slim AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# El tablero lee la base en cada peticion; ninguna pagina se prerenderiza en el
# build, asi que la construccion no necesita credenciales de base de datos.
ENV NEXT_TELEMETRY_DISABLED=1
# `public/` lleva el QR de donacion. `mkdir -p` no lo toca cuando ya esta y
# evita que la copia de la etapa final falle en una rama que aun no lo traiga.
RUN mkdir -p public && npm run build

FROM node:22.16.0-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN groupadd --system --gid 10001 dashboard \
    && useradd --system --uid 10001 --gid dashboard --home-dir /app dashboard
# El bundle standalone trae su propio server.js y solo las dependencias que este
# usa; los estaticos y `public/` quedan fuera de el y se copian aparte.
COPY --from=build --chown=dashboard:dashboard /app/.next/standalone ./
COPY --from=build --chown=dashboard:dashboard /app/.next/static ./.next/static
COPY --from=build --chown=dashboard:dashboard /app/public ./public
USER dashboard
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
