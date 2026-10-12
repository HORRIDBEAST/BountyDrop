/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Leaflet + react-leaflet touch `window`/`document` at import time, so
  // QuestMap must be dynamically imported with { ssr: false } everywhere
  // it's used (see components/QuestMap.tsx usage in app/quests/page.tsx).
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

module.exports = nextConfig;
