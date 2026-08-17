// One-off script: regenerates the PWA/favicon PNGs using the exact same
// orange->green brand gradient as the site's .text-gradient-mars-earth logo
// (src/app/globals.css), so the icon can never visually drift from the
// header wordmark again. Run with: node scripts/generate-icons.mjs
//
// Root cause being fixed: the old icon artwork had its accent color close
// to the edge with no maskable safe-zone margin, so OS-level circular/
// squircle icon masking cropped it into a green/white/orange-red block
// pattern that read as a flag. This version keeps all content inside an
// 80% centered safe zone and uses a two-color (no white gap) diagonal
// split for the smallest sizes so it can never read as a tricolor flag.

import { ImageResponse } from 'next/og.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const ORANGE = '#E8651A';
const GREEN = '#2D6A4F';

async function toBuffer(response) {
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Full wordmark badge (192/512/apple-touch): gradient background, "CSS" in
// bold white centered, "berlin" beneath it -- both kept inside the ~80%
// safe zone so maskable cropping never clips them.
function wordmarkIcon(size, { safeZonePct = 0.8 } = {}) {
  const pad = Math.round((size * (1 - safeZonePct)) / 2);
  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${ORANGE} 0%, ${GREEN} 100%)`,
          padding: pad,
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                color: '#ffffff',
                fontSize: Math.round(size * 0.34),
                fontWeight: 800,
                letterSpacing: -1,
                lineHeight: 1,
              },
              children: 'CSS',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                color: 'rgba(255,255,255,0.92)',
                fontSize: Math.round(size * 0.16),
                fontWeight: 700,
                letterSpacing: -0.5,
                lineHeight: 1,
                marginTop: Math.round(size * 0.02),
              },
              children: 'berlin',
            },
          },
        ],
      },
    },
    { width: size, height: size }
  );
}

// Small-size glyph (32px favicon): a simple two-color diagonal split, no
// text (illegible at this size anyway) and deliberately only 2 colors
// with no white gap between them, so it cannot be mistaken for a flag.
function smallGlyph(size) {
  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE} 48%, ${GREEN} 52%, ${GREEN} 100%)`,
        },
        children: [],
      },
    },
    { width: size, height: size }
  );
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  const jobs = [
    ['icon-192.png', wordmarkIcon(192)],
    ['icon-512.png', wordmarkIcon(512)],
    ['apple-touch-icon.png', wordmarkIcon(180, { safeZonePct: 0.86 })],
    ['favicon-32x32.png', smallGlyph(32)],
  ];

  for (const [filename, response] of jobs) {
    const buffer = await toBuffer(response);
    await writeFile(join(publicDir, filename), buffer);
    console.log(`wrote ${filename} (${buffer.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
