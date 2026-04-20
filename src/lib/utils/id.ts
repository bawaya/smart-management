// Generates a 32-char hex id (128 bits of UUID v4 entropy, hyphens removed).
// Uses the Web Crypto API — works in Node 19+, Cloudflare Workers, Edge runtimes.
export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
