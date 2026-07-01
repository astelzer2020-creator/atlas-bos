import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@atlas/ui'],
  reactStrictMode: true,
};

export default nextConfig;