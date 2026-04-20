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
    // Keeps the native module out of the Node-runtime Server Components
    // bundle. Edge-runtime builds are handled separately via the webpack
    // IgnorePlugin below — serverComponentsExternalPackages doesn't apply
    // to the edge pipeline.
    serverComponentsExternalPackages: ['better-sqlite3'],
  },

  // better-sqlite3 is imported by src/lib/db/sqlite-adapter.ts, which the
  // development path of getDb() reaches via require(). With process.env.
  // NODE_ENV === 'production' in the edge build, that branch is unreachable,
  // but webpack resolves require() calls before DCE runs — so the import
  // graph still pulls better-sqlite3 (and its deps bindings / file-uri-to-
  // path) into the edge bundle, and they try to require('path') which isn't
  // available at edge.
  //
  // Fix: ignore better-sqlite3 and its native-loader deps in edge builds.
  // The imports resolve to empty modules; sqlite-adapter.ts still loads but
  // its `new Database(...)` would throw if called — and it never is in
  // production, since getDb() branches on NODE_ENV first.
  webpack: (config, { webpack, nextRuntime }) => {
    if (nextRuntime === 'edge') {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(better-sqlite3|bindings|file-uri-to-path)$/,
        }),
      );
    }
    return config;
  },
};

export default withPWA(nextConfig);
