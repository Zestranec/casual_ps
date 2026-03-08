import { Assets, Texture } from "pixi.js";

/**
 * Frame keys as they appear in pirates_atlas.json — match the source PNG
 * filenames packed by buildPiratesAtlas.js.
 */
export const PIRATES_TEXTURE_MAP = {
  anchor:              "anchor.png",
  bottleOfRome:        "bottle-of-rome.png",
  compass:             "compass.png",
  girlPiratePistol:    "girl-pirate-pistol.png",
  girlPirateWithMonkey:"girl_pirate_with_monkey.png",
  mainHero:            "main-hero.png",
  pirateOfficer:       "pirate-officer.png",
  pirateWithTattooHook:"pirate-with-tattoo-hook.png",
  pistols:             "pistols.png",
  steeringWheel:       "steering-wheel.png",
  wildCoin:            "wild-coin.png",
} as const;

export type PirateTextureKey = keyof typeof PIRATES_TEXTURE_MAP;

/**
 * Ordered list of pirate symbol frame keys.
 * Index in this array becomes the symbol index used by the reel engine for
 * pirates kingdom levels (analogous to SYMBOL_POOL for cards).
 */
export const PIRATE_SYMBOL_FRAMES: readonly string[] = [
  PIRATES_TEXTURE_MAP.anchor,
  PIRATES_TEXTURE_MAP.bottleOfRome,
  PIRATES_TEXTURE_MAP.compass,
  PIRATES_TEXTURE_MAP.girlPiratePistol,
  PIRATES_TEXTURE_MAP.girlPirateWithMonkey,
  PIRATES_TEXTURE_MAP.mainHero,
  PIRATES_TEXTURE_MAP.pirateOfficer,
  PIRATES_TEXTURE_MAP.pirateWithTattooHook,
  PIRATES_TEXTURE_MAP.pistols,
  PIRATES_TEXTURE_MAP.steeringWheel,
  PIRATES_TEXTURE_MAP.wildCoin,
];

/**
 * Retrieve a pirate Texture by its named key from PIRATES_TEXTURE_MAP.
 * Requires loadPiratesAssets() to have completed first.
 * Falls back to Texture.WHITE if the atlas is not yet loaded.
 */
export function getPirateTexture(key: PirateTextureKey): Texture {
  const frameName = PIRATES_TEXTURE_MAP[key];
  const t = Assets.get<Texture>(frameName);
  return t instanceof Texture ? t : Texture.WHITE;
}

/**
 * Retrieve a pirate Texture by its symbol index (position in PIRATE_SYMBOL_FRAMES).
 * Requires loadPiratesAssets() to have completed first.
 * Falls back to Texture.WHITE for out-of-range indices.
 */
export function getPirateTextureByIndex(idx: number): Texture {
  const frameName = PIRATE_SYMBOL_FRAMES[idx];
  if (!frameName) return Texture.WHITE;
  const t = Assets.get<Texture>(frameName);
  return t instanceof Texture ? t : Texture.WHITE;
}
