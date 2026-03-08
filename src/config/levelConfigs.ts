/**
 * Per-level game configuration.
 *
 * The reel engine (TapeSlotModel, SpinController, ReelAnimator) and the view
 * builder in main.ts read from this config at level start instead of relying
 * on module-level constants.  Adding a new level with a different reel count
 * requires only a new entry in LEVEL_CONFIGS — no engine code changes needed.
 */
export interface LevelConfig {
  /** Unique compound key, e.g. "cards-1" */
  id: string;
  /** Kingdom this level belongs to */
  kingdomId: string;
  /** 1-based level number within the kingdom */
  levelNumber: number;
  /**
   * Number of reels for this level.
   * The model and spin engine scale to this value.
   * The view layer (main.ts) pre-builds MAX_REEL_COUNT slots and hides extras.
   */
  reelCount: number;
}

// ── Level definitions ─────────────────────────────────────────────────────────

const LEVEL_DEFS: LevelConfig[] = [
  // Cards Kingdom
  { id: "cards-1",   kingdomId: "cards",   levelNumber: 1, reelCount: 5 },
  { id: "cards-2",   kingdomId: "cards",   levelNumber: 2, reelCount: 5 },
  { id: "cards-3",   kingdomId: "cards",   levelNumber: 3, reelCount: 5 },
  { id: "cards-4",   kingdomId: "cards",   levelNumber: 4, reelCount: 5 },

  // Pirates Kingdom
  { id: "pirates-1", kingdomId: "pirates", levelNumber: 1, reelCount: 5 },
  { id: "pirates-2", kingdomId: "pirates", levelNumber: 2, reelCount: 5 },
  { id: "pirates-3", kingdomId: "pirates", levelNumber: 3, reelCount: 5 },
  { id: "pirates-4", kingdomId: "pirates", levelNumber: 4, reelCount: 5 },
];

/** Map for O(1) lookups by id. */
export const LEVEL_CONFIGS: ReadonlyMap<string, LevelConfig> =
  new Map(LEVEL_DEFS.map(c => [c.id, c]));

/** Look up a config by its compound key.  Throws if the id is unknown. */
export function getLevelConfig(id: string): LevelConfig {
  const cfg = LEVEL_CONFIGS.get(id);
  if (!cfg) throw new Error(`Unknown level config: "${id}"`);
  return cfg;
}

/** The level that is played first (and used to size the initial view). */
export const DEFAULT_LEVEL_ID     = "cards-1";
export const DEFAULT_LEVEL_CONFIG = getLevelConfig(DEFAULT_LEVEL_ID);

/**
 * Maximum reel count across all defined levels.
 * main.ts pre-builds this many reel view slots so that any level can start
 * without rebuilding the DOM/Pixi hierarchy.
 */
export const MAX_REEL_COUNT: number =
  Math.max(...LEVEL_DEFS.map(c => c.reelCount));

/** Levels per kingdom (same for all kingdoms in the current design). */
export const LEVELS_PER_KINGDOM = 4;

/** Kingdom display names, keyed by kingdomId. */
export const KINGDOM_NAMES: Readonly<Record<string, string>> = {
  cards:   "Cards Kingdom",
  pirates: "Pirates Kingdom",
};

/** Ordered kingdom ids (controls display order on the Level Select screen). */
export const KINGDOM_ORDER: readonly string[] = ["cards", "pirates"];
