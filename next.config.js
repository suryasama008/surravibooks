/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PWA is handled via public/sw.js (manual service worker)
  // No next-pwa needed
}

module.exports = nextConfig
