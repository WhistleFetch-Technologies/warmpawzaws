/**
 * Crop category + hero images from design mockups into public/images/home.
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const mockupDir = path.join(
  process.env.APPDATA || '',
  'Cursor',
  'User',
  'workspaceStorage',
  'c4f551edef4b6da66e6b48cc82817aa2',
  'images'
);

const homeMockup = path.join(
  mockupDir,
  '9829D366-D8E6-418A-97D7-3194391F631B (1)-8e1c000b-6b05-4b98-bc6d-7dd3ba6f6ec1.png'
);
const allServicesMockup = path.join(
  mockupDir,
  'image-af4487e7-dbc4-4382-905c-3761badfd9ca.png'
);

const outDir = path.join(appRoot, 'public/images/home');

/** @type {{ name: string; src: string; left: number; top: number; width: number; height: number }[]} */
const crops = [
  { name: 'hero-pet', src: 'home', left: 198, top: 302, width: 272, height: 168 },
  { name: 'grooming', src: 'all', left: 18, top: 178, width: 258, height: 118 },
  { name: 'vet', src: 'all', left: 300, top: 178, width: 258, height: 118 },
  { name: 'boarding', src: 'all', left: 18, top: 398, width: 258, height: 118 },
  { name: 'walking', src: 'all', left: 300, top: 398, width: 258, height: 118 },
  { name: 'pet-sitting', src: 'all', left: 18, top: 838, width: 258, height: 118 },
];

function sourcePath(which) {
  return which === 'home' ? homeMockup : allServicesMockup;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of ['home', 'all']) {
    const p = sourcePath(file);
    if (!fs.existsSync(p)) {
      console.error(`Missing mockup: ${p}`);
      process.exit(1);
    }
  }

  for (const crop of crops) {
    const input = sourcePath(crop.src);
    const pngOut = path.join(outDir, `${crop.name}.png`);
    const webpOut = path.join(outDir, `${crop.name}.webp`);

    const base = sharp(input).extract({
      left: crop.left,
      top: crop.top,
      width: crop.width,
      height: crop.height,
    });

    await base.clone().png({ compressionLevel: 9 }).toFile(pngOut);
    await base.clone().webp({ quality: 85 }).toFile(webpOut);
    console.log(`Wrote ${crop.name}.png + .webp`);
  }

  console.log(`Done → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
