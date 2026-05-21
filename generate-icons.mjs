/**
 * generate-icons.mjs
 * Generates all required icon sizes from the master 512x512 icon.
 * Run with: node generate-icons.mjs
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, 'public', 'icon-512.png');
const androidRes = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

async function resize(inputPath, outputPath, size) {
  await sharp(inputPath)
    .resize(size, size, { fit: 'contain', background: { r: 10, g: 15, b: 26, alpha: 1 } })
    .png()
    .toFile(outputPath);
  console.log(`✅ Generated: ${outputPath} (${size}x${size})`);
}

async function main() {
  // ─── PWA Icons (public/) ───
  await resize(src, path.join(__dirname, 'public', 'icon-192.png'), 192);
  await resize(src, path.join(__dirname, 'public', 'apple-touch-icon.png'), 180);
  console.log('✅ PWA icons updated');

  // ─── Android Launcher Icons (mipmap-*) ───
  const androidSizes = {
    'mipmap-mdpi':    48,
    'mipmap-hdpi':    72,
    'mipmap-xhdpi':   96,
    'mipmap-xxhdpi':  144,
    'mipmap-xxxhdpi': 192,
  };

  for (const [folder, size] of Object.entries(androidSizes)) {
    const dir = path.join(androidRes, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await resize(src, path.join(dir, 'ic_launcher.png'), size);
    await resize(src, path.join(dir, 'ic_launcher_round.png'), size);
  }
  console.log('✅ Android icons updated');
  console.log('\n🎉 All icons generated successfully!');
}

main().catch(console.error);
