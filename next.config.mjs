/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  serverExternalPackages: ['@libsql/client'],
};

export default nextConfig;
