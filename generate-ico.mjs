/**
 * generate-ico.mjs
 * Converts the master PNG icon to Windows .ico format (multi-size).
 * Run with: node generate-ico.mjs
 */
import pngToIco from 'png-to-ico';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPng = path.join(__dirname, 'public', 'icon-512.png');
const outputIco = path.join(__dirname, 'horus_icon.ico');

// ICO files need multiple sizes: 16, 32, 48, 64, 128, 256
const sizes = [16, 32, 48, 64, 128, 256];
const tempDir = path.join(__dirname, 'temp_ico');

async function main() {
  // Create temp directory for resized PNGs
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  // Generate each size as a temp PNG
  const tempPaths = [];
  for (const size of sizes) {
    const tempPath = path.join(tempDir, `icon-${size}.png`);
    await sharp(srcPng)
      .resize(size, size, { fit: 'contain', background: { r: 10, g: 15, b: 26, alpha: 1 } })
      .png()
      .toFile(tempPath);
    tempPaths.push(tempPath);
    console.log(`  ✅ Resized to ${size}x${size}`);
  }

  // Convert all sizes into one .ico file
  const icoBuffer = await pngToIco(tempPaths);
  fs.writeFileSync(outputIco, icoBuffer);
  console.log(`\n🎉 ICO generated: ${outputIco}`);

  // Cleanup temp files
  for (const p of tempPaths) fs.unlinkSync(p);
  fs.rmdirSync(tempDir);
  console.log('🧹 Temp files cleaned.');
}

main().catch(console.error);
