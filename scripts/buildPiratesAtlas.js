/**
 * buildPiratesAtlas.js
 *
 * Packs all PNG files in public/assets/pirates/ into a single PixiJS-compatible
 * texture atlas (PNG + JSON) written to public/assets/pirates_atlas/.
 *
 * Uses:
 *   - maxrects-packer  (already installed as a dep of free-tex-packer-cli)
 *   - sharp            (devDependency)
 *
 * Run via:   npm run build-pirates-atlas
 */

import sharp from "sharp";
import { MaxRectsPacker } from "maxrects-packer";
import { readdir } from "fs/promises";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, "..");
const INPUT_DIR  = path.join(ROOT, "public", "assets", "pirates");
const OUTPUT_DIR = path.join(ROOT, "public", "assets", "pirates_atlas");
const ATLAS_PNG  = path.join(OUTPUT_DIR, "pirates_atlas.png");
const ATLAS_JSON = path.join(OUTPUT_DIR, "pirates_atlas.json");

const PADDING  = 4;
const MAX_SIZE = 2048;
/**
 * Pirate assets are character/object illustrations with varied aspect ratios.
 * We fit each inside a 200×200 box (preserving aspect ratio, transparent fill)
 * so all frames are the same declared size while artwork remains undistorted.
 */
const FRAME_SIZE = 200;

/** Smallest power-of-2 >= n. */
function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

async function main() {
  // 1. Collect PNG files.
  const entries = await readdir(INPUT_DIR);
  const files   = entries
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .map((f)    => ({ name: f, fullPath: path.join(INPUT_DIR, f) }));

  if (files.length === 0) {
    console.error("No PNG files found in", INPUT_DIR);
    process.exit(1);
  }

  console.log(`Found ${files.length} PNG files in ${INPUT_DIR}`);

  // 2. Resize each image to fit inside FRAME_SIZE × FRAME_SIZE, preserving
  //    aspect ratio.  Transparent areas are padded to keep all frames the same
  //    declared w/h, which makes atlas math simple and sprite sizing consistent.
  const images = await Promise.all(
    files.map(async ({ name, fullPath }) => {
      const buf = await sharp(fullPath)
        .resize(FRAME_SIZE, FRAME_SIZE, {
          fit:        "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      return { name, buf, w: FRAME_SIZE, h: FRAME_SIZE };
    }),
  );

  // 3. Bin-pack with maxrects-packer.
  const packer = new MaxRectsPacker(MAX_SIZE, MAX_SIZE, PADDING, {
    smart:         true,
    pot:           false, // we do manual pow2 after
    square:        false,
    allowRotation: false,
    border:        PADDING,
  });

  packer.addArray(images.map(({ name, buf, w, h }) => ({
    width:  w,
    height: h,
    data:   { name, buf, w, h },
  })));

  if (packer.bins.length === 0) {
    console.error("Packing produced no bins — check your images.");
    process.exit(1);
  }
  if (packer.bins.length > 1) {
    console.warn(`Warning: images span ${packer.bins.length} bins; only the first bin is used.`);
  }

  const bin = packer.bins[0];

  // 4. Determine output dimensions (next power-of-2 for GPU alignment).
  const atlasW = nextPow2(bin.width);
  const atlasH = nextPow2(bin.height);

  // 5. Composite all frames onto a transparent canvas via sharp.
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const compositeInputs = bin.rects.map((rect) => ({
    input: rect.data.buf,
    left:  Math.round(rect.x),
    top:   Math.round(rect.y),
  }));

  await sharp({
    create: {
      width:      atlasW,
      height:     atlasH,
      channels:   4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeInputs)
    .png()
    .toFile(ATLAS_PNG);

  // 6. Build PixiJS-compatible spritesheet JSON.
  const frames = {};
  for (const rect of bin.rects) {
    const { name, w, h } = rect.data;
    const x = Math.round(rect.x);
    const y = Math.round(rect.y);
    frames[name] = {
      frame:            { x, y, w, h },
      rotated:          false,
      trimmed:          false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize:       { w, h },
    };
  }

  const json = {
    frames,
    meta: {
      app:     "buildPiratesAtlas",
      version: "1.0",
      image:   "pirates_atlas.png",
      format:  "RGBA8888",
      size:    { w: atlasW, h: atlasH },
      scale:   "1",
    },
  };

  writeFileSync(ATLAS_JSON, JSON.stringify(json, null, 2));

  console.log(`✓ Pirates atlas generated: ${atlasW} × ${atlasH} px`);
  console.log(`  Frames packed:           ${bin.rects.length}`);
  console.log(`  Output:                  ${OUTPUT_DIR}`);
  console.log(`\n  Frames:`);
  for (const rect of bin.rects) {
    console.log(`    ${rect.data.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
