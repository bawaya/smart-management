import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const DARK = '#0f0f1a';
const GOLD = '#f59e0b';
const OUT_DIR = 'public/icons';

function bars(x, y, areaWidth, areaHeight) {
  const cols = 4;
  const gap = areaWidth * 0.05;
  const w = (areaWidth - gap * (cols + 1)) / cols;
  const heights = [0.3, 0.5, 0.7, 0.95];
  const parts = [];
  for (let i = 0; i < cols; i++) {
    const h = areaHeight * heights[i];
    const bx = x + gap + i * (w + gap);
    const by = y + areaHeight - h;
    parts.push(
      `<rect x="${bx}" y="${by}" width="${w}" height="${h}" fill="${GOLD}" rx="${w * 0.12}"/>`,
    );
  }
  return parts.join('');
}

function regularIcon(size) {
  const padding = size * 0.14;
  const inner = size - padding * 2;
  const radius = size * 0.18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${DARK}"/>
    ${bars(padding, padding, inner, inner)}
  </svg>`;
}

function maskableIcon(size) {
  const safeInset = size * 0.18;
  const inner = size - safeInset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${DARK}"/>
    ${bars(safeInset, safeInset, inner, inner)}
  </svg>`;
}

async function renderPng(svgString, filename) {
  await sharp(Buffer.from(svgString))
    .png({ compressionLevel: 9 })
    .toFile(`${OUT_DIR}/${filename}`);
  console.log(`[icons] ${filename}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await renderPng(regularIcon(192), 'icon-192.png');
  await renderPng(regularIcon(512), 'icon-512.png');
  await renderPng(maskableIcon(512), 'icon-maskable-512.png');
  console.log('[icons] Done.');
}

main().catch((err) => {
  console.error('[icons] Failed:', err);
  process.exit(1);
});
