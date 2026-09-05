import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El contenedor arranca con `node server.js` sobre este bundle: trae solo las
  // dependencias que el servidor usa realmente, en vez de un node_modules entero.
  output: 'standalone',
  // Next deduce la raiz del proyecto buscando lockfiles hacia arriba, y con otro
  // lockfile por encima de la carpeta elige la equivocada: el bundle standalone
  // sale entonces con las rutas corridas y `node server.js` no encuentra nada.
  // Fijarla hace que el build de la imagen y el de una maquina cualquiera
  // produzcan la misma disposicion.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  // The dashboard reads the database on every request: a cached page would
  // quietly show an exchange rate that is no longer the one in force.
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
};

export default nextConfig;
