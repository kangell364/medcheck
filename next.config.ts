import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['twilio', 'pg'],
  // Prevent Vercel/Next from trying to pre-render/export pages during build.
  // This avoids build-time failures when env vars aren't present in the build worker.
  output: 'standalone',
}

export default nextConfig
