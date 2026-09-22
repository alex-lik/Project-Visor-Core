/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  serverExternalPackages: ['@libsql/client'],
  allowedDevOrigins: ['127.0.0.1', '127.0.0.1:3005', 'localhost', 'localhost:3005'],
};

export default nextConfig;
