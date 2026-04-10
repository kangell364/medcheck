import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['twilio', 'pg'],
}

export default nextConfig
