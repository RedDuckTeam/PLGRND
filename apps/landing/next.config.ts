import createMDX from '@next/mdx'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  pageExtensions: ['ts', 'tsx', 'mdx'],
}

const withMDX = createMDX()

export default withMDX(nextConfig)
