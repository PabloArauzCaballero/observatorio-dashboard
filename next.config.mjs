/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The dashboard reads the database on every request: a cached page would
  // quietly show an exchange rate that is no longer the one in force.
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
};

export default nextConfig;
