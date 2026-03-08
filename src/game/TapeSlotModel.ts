import { RNG } from "../core/RNG";
import { TapeReel } from "./TapeReel";

/**
 * Kept as the historical default so existing call-sites that don't pass a
 * reelCount still get 5 reels.  The engine itself no longer hard-codes this
 * value — it reads `this.reelCount` everywhere.
 */
export const REEL_COUNT = 5;
export const DEFAULT_TAPE_LENGTH = 30;

export class TapeSlotModel {
  reels: TapeReel[] = [];
  private _seed: number;
  readonly tapeLength: number;

  /**
   * How many reels this model manages.  Determined at construction from the
   * active level config so the engine scales to any reel count without code
   * changes.
   */
  readonly reelCount: number;

  /** Per-reel lock state. Locked reels receive delta=0 on spin. */
  private _locks: boolean[] = [];

  get seed(): number { return this._seed; }

  constructor(
    seed:       number = 42,
    tapeLength: number = DEFAULT_TAPE_LENGTH,
    reelCount:  number = REEL_COUNT,
  ) {
    this._seed     = seed;
    this.tapeLength = tapeLength;
    this.reelCount  = reelCount;
    this.rebuildFromSeed(seed);
  }

  rebuildFromSeed(seed: number): void {
    this._seed = seed;
    const rng  = new RNG(seed);
    this.reels = [];
    for (let i = 0; i < this.reelCount; i++) {
      this.reels.push(TapeReel.generate(rng, this.tapeLength));
    }
    this._locks = new Array(this.reelCount).fill(false);
  }

  // ── Lock state API ──────────────────────────────────────────────────────────

  isLocked(i: number): boolean  { return this._locks[i] ?? false; }

  setLocked(i: number, value: boolean): void { this._locks[i] = value; }

  toggleLocked(i: number): void { this._locks[i] = !this._locks[i]; }

  getLockStates(): boolean[] { return [...this._locks]; }

  /** Number of reels currently locked. */
  lockedCount(): number { return this._locks.filter(Boolean).length; }

  /** Reset all locks to false (does NOT touch offsets or tapes). */
  resetLocks(): void { this._locks = new Array(this.reelCount).fill(false); }

  /** Returns array of center symbol indices, one per reel. */
  getVisibleCenterDigits(): number[] {
    return this.reels.map(r => r.getVisible().center);
  }

  /** Human-readable string of center symbols, for debugging. */
  getVisibleString(): string {
    return this.getVisibleCenterDigits().join(" ");
  }

  getOffsets(): number[] { return this.reels.map(r => r.offset); }

  /** Randomize all offsets deterministically from a sub-RNG. */
  randomizeOffsets(rng: RNG): void {
    for (const reel of this.reels) {
      reel.setOffset(rng.nextInt(0, reel.length - 1));
    }
  }

  resetOffsets(): void {
    for (const reel of this.reels) reel.setOffset(0);
  }
}
