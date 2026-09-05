/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El contenedor arranca con `node server.js` sobre este bundle: trae solo las
  // dependencias que el servidor usa realmente, en vez de un node_modules entero.
  output: 'standalone',
  // The dashboard reads the database on every request: a cached page would
  // quietly show an exchange rate that is no longer the one in force.
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
};

export default nextConfig;
