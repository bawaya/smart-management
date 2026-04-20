import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline.html',
  },
});

// Wire up Cloudflare bindings for `next dev`. Non-fatal if it fails — the dev
// path uses better-sqlite3 directly and doesn't rely on getRequestContext().
if (process.env.NODE_ENV === 'development') {
  try {
    const { setupDevPlatform } = await import(
      '@cloudflare/next-on-pages/next-dev'
    );
    await setupDevPlatform();
  } catch (err) {
    console.warn(
      '[next-dev] setupDevPlatform skipped:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    // better-sqlite3 is a native Node module — dev only. Keep it out of the
    // Server Components bundle so Cloudflare Workers never tries to load it.
    // The prod branch of getDb() uses D1 instead; DCE drops the dev branch.
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

export default withPWA(nextConfig);
