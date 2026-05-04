import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, 'forge-pwa', 'assets');
if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });

// ── FORGE icon SVG (512x512 logical, rendered at target px) ────────────────
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#04080F"/>
  <path d="M112 132h288v54H176v66h186v54H176v102h-64V132Z" fill="#00E5FF"/>
  <path d="M112 132h288v16H112V132Zm64 120h186v16H176v-16Z" fill="#00FF87" opacity=".75"/>
  <path d="M360 370c0 33-27 60-60 60s-60-27-60-60 27-60 60-60 60 27 60 60Z" fill="#FFB020"/>
  <path d="M300 334l13 26 29 4-21 20 5 29-26-14-26 14 5-29-21-20 29-4 13-26Z" fill="#04080F"/>
</svg>`;

// Adaptive icon foreground (icon centred on transparent bg, no rounded rect)
const adaptiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="M112 132h288v54H176v66h186v54H176v102h-64V132Z" fill="#00E5FF"/>
  <path d="M112 132h288v16H112V132Zm64 120h186v16H176v-16Z" fill="#00FF87" opacity=".75"/>
  <path d="M360 370c0 33-27 60-60 60s-60-27-60-60 27-60 60-60 60 27 60 60Z" fill="#FFB020"/>
  <path d="M300 334l13 26 29 4-21 20 5 29-26-14-26 14 5-29-21-20 29-4 13-26Z" fill="#04080F"/>
</svg>`;

// Splash screen SVG: 2048x2048, dark bg, centred icon + brand name
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048">
  <rect width="2048" height="2048" fill="#04080F"/>
  <!-- icon centred at 1024,860, scaled 3× -->
  <g transform="translate(768, 604) scale(1.875)">
    <rect width="512" height="512" rx="112" fill="#04080F"/>
    <path d="M112 132h288v54H176v66h186v54H176v102h-64V132Z" fill="#00E5FF"/>
    <path d="M112 132h288v16H112V132Zm64 120h186v16H176v-16Z" fill="#00FF87" opacity=".75"/>
    <path d="M360 370c0 33-27 60-60 60s-60-27-60-60 27-60 60-60 60 27 60 60Z" fill="#FFB020"/>
    <path d="M300 334l13 26 29 4-21 20 5 29-26-14-26 14 5-29-21-20 29-4 13-26Z" fill="#04080F"/>
  </g>
  <!-- brand name -->
  <text x="1024" y="1560"
    font-family="Arial Black, Arial, sans-serif"
    font-size="120" font-weight="900"
    fill="#00E5FF" text-anchor="middle" letter-spacing="32">// FORGE</text>
  <text x="1024" y="1660"
    font-family="Arial, sans-serif"
    font-size="48" font-weight="700"
    fill="rgba(160,200,240,0.60)" text-anchor="middle" letter-spacing="8">TACTICAL FITNESS</text>
</svg>`;

function render(svg, size, outPath) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  writeFileSync(outPath, pngBuffer);
  console.log(`✓ ${outPath} (${size}×${size})`);
}

render(iconSvg,    1024, join(assetsDir, 'icon.png'));
render(adaptiveSvg,1024, join(assetsDir, 'adaptive-icon.png'));
render(splashSvg,  2048, join(assetsDir, 'splash.png'));

console.log('\nAll assets generated successfully.');
