import {
  Application, Container, Graphics, Rectangle,
  Sprite, Text, TextStyle, Texture, FederatedPointerEvent,
} from "pixi.js";
import { GameStateMachine, GameState } from "./core/GameStateMachine";
import { getNearMissHint } from "./game/CardEvaluator";
import { CARDS } from "./config/cards";
import { TapeSlotModel } from "./game/TapeSlotModel";
import { VisibleDigits } from "./game/TapeReel";
import { getSymbolTexture } from "./game/CardTextures";
import { ReelAnimator, ReelViewRef } from "./game/ReelAnimator";
import { SpinController } from "./game/SpinController";
import { RunController } from "./game/RunController";
import { CardController } from "./game/CardController";
import { EconomyController } from "./game/EconomyController";
import { DevDrawer } from "./ui/DevDrawer";
import { RunPanel } from "./ui/RunPanel";
import { CardGrid } from "./ui/CardGrid";
import { ToastMessage } from "./ui/ToastMessage";
import { LoadingScreen, loadAssets, logoUrl } from "./ui/LoadingScreen";
import { RulesScreen, rulesAlreadySeen } from "./ui/RulesScreen";
import { LevelSelectScreen } from "./ui/LevelSelectScreen";
import { LivesDisplay } from "./ui/LivesDisplay";
import { computeLayout } from "./ui/layouts";
import {
  DEFAULT_LEVEL_CONFIG,
  getLevelConfig,
  MAX_REEL_COUNT,
  KINGDOM_NAMES,
  LEVELS_PER_KINGDOM,
} from "./config/levelConfigs";

// ─────────────────────────────────────────────────────────────────────────────
// REEL VISUAL CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const REEL_WIDTH      = 120;
const REEL_HEIGHT     = 160;
const REEL_GAP        = 8;
// View slots are pre-built for the maximum reel count across all levels so
// that any level can start without rebuilding the Pixi hierarchy.
const REEL_AREA_WIDTH = MAX_REEL_COUNT * REEL_WIDTH + (MAX_REEL_COUNT - 1) * REEL_GAP;

const NUDGE_H   = 18;
const NUDGE_GAP = 3;
const LOCK_H    = 16;

const CTRL_ABOVE  = NUDGE_H + NUDGE_GAP;
const CTRL_BELOW  = NUDGE_GAP + NUDGE_H + 3 + LOCK_H;
const REEL_SLOT_H = CTRL_ABOVE + REEL_HEIGHT + CTRL_BELOW;

const SYMBOL_W = 96;
const SYMBOL_H = 96;

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const UI_W        = 700;
const PAD_TOP     = 16;
const REEL_SLOT_Y = 42;
const PANEL_GAP   = 14;
const BLOCK_GAP   = 16;
const PANEL_TOP   = REEL_SLOT_Y + REEL_SLOT_H + PANEL_GAP;

// ─────────────────────────────────────────────────────────────────────────────
// TEXT STYLES
// ─────────────────────────────────────────────────────────────────────────────
const LOCK_BTN_OFF_STYLE  = new TextStyle({ fontFamily: "Arial, sans-serif", fontSize: 10, fill: 0x6666aa });
const LOCK_BTN_ON_STYLE   = new TextStyle({ fontFamily: "Arial, sans-serif", fontSize: 10, fill: 0xffaa00, fontWeight: "bold" });
const NEAR_MISS_LBL_STYLE = new TextStyle({ fontFamily: "Arial, sans-serif", fontSize: 10, fill: 0xff8800, fontWeight: "bold" });

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESSION STATE
// ─────────────────────────────────────────────────────────────────────────────
const PROGRESSION_KEY = "puzzle_progression";

interface Progression {
  lives:             number;
  /** Compound level keys that are unlocked, e.g. ["cards-1", "cards-2"]. */
  unlockedLevelIds:  string[];
}

const MAX_LIVES          = 3;
const INITIAL_UNLOCKED   = ["cards-1"];

function loadProgression(): Progression {
  try {
    const raw = localStorage.getItem(PROGRESSION_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progression;
      if (
        typeof p.lives === "number" &&
        Array.isArray(p.unlockedLevelIds) &&
        p.unlockedLevelIds.every((v) => typeof v === "string")
      ) return p;
    }
  } catch { /* ignore */ }
  return { lives: MAX_LIVES, unlockedLevelIds: [...INITIAL_UNLOCKED] };
}

function saveProgression(p: Progression): void {
  try { localStorage.setItem(PROGRESSION_KEY, JSON.stringify(p)); }
  catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// REEL VIEW
// ─────────────────────────────────────────────────────────────────────────────
interface ReelView extends ReelViewRef {
  slot:           Container;
  container:      Container;
  symbolsLayer:   Container;
  aboveSprite:    Sprite;
  centerSprite:   Sprite;
  belowSprite:    Sprite;
  lockOverlay:    Graphics;
  nudgeUp:        Container;
  nudgeDown:      Container;
  lockBtn:        Container;
  lockBtnBg:      Graphics;
  lockBtnLabel:   Text;
  centerHit:      Container;
  nearMissGlow:   Graphics;
  nearMissLabel:  Text;
}

function createReelView(): ReelView {
  const CX = REEL_WIDTH / 2;
  const HW = 14;

  const slot = new Container();

  const nudgeUp = new Container();
  nudgeUp.y         = 0;
  nudgeUp.eventMode = "static";
  nudgeUp.cursor    = "pointer";
  nudgeUp.hitArea   = new Rectangle(CX - HW, 0, HW * 2, NUDGE_H);
  const nudgeUpGfx  = new Graphics();
  nudgeUpGfx.poly([CX, 2, CX + HW, NUDGE_H - 2, CX - HW, NUDGE_H - 2]);
  nudgeUpGfx.fill({ color: 0x3366cc });
  nudgeUp.addChild(nudgeUpGfx);
  nudgeUp.on("pointerover", () => { nudgeUpGfx.tint = 0xaaddff; });
  nudgeUp.on("pointerout",  () => { nudgeUpGfx.tint = 0xffffff; });
  slot.addChild(nudgeUp);

  const container = new Container();
  container.y = CTRL_ABOVE;

  const bg = new Graphics();
  bg.roundRect(0, 0, REEL_WIDTH, REEL_HEIGHT, 6);
  bg.fill({ color: 0x22223a });
  bg.stroke({ color: 0x4a4a7a, width: 2 });
  bg.eventMode = "none";
  container.addChild(bg);

  const symbolsLayer = new Container();
  container.addChild(symbolsLayer);

  const aboveSprite = new Sprite(Texture.WHITE);
  aboveSprite.anchor.set(0.5);
  aboveSprite.x = CX; aboveSprite.y = -16;
  aboveSprite.width = SYMBOL_W; aboveSprite.height = SYMBOL_H;
  aboveSprite.alpha = 0.4;
  symbolsLayer.addChild(aboveSprite);

  const centerSprite = new Sprite(Texture.WHITE);
  centerSprite.anchor.set(0.5);
  centerSprite.x = CX; centerSprite.y = REEL_HEIGHT / 2;
  centerSprite.width = SYMBOL_W; centerSprite.height = SYMBOL_H;
  symbolsLayer.addChild(centerSprite);

  const belowSprite = new Sprite(Texture.WHITE);
  belowSprite.anchor.set(0.5);
  belowSprite.x = CX; belowSprite.y = 176;
  belowSprite.width = SYMBOL_W; belowSprite.height = SYMBOL_H;
  belowSprite.alpha = 0.4;
  symbolsLayer.addChild(belowSprite);

  const reelMask = new Graphics();
  reelMask.rect(0, 0, REEL_WIDTH, REEL_HEIGHT);
  reelMask.fill({ color: 0xffffff });
  container.addChild(reelMask);
  container.mask = reelMask;

  const lockOverlay = new Graphics();
  lockOverlay.roundRect(1, 1, REEL_WIDTH - 2, REEL_HEIGHT - 2, 5);
  lockOverlay.fill({ color: 0xffaa00, alpha: 0.18 });
  lockOverlay.stroke({ color: 0xffaa00, width: 2 });
  lockOverlay.visible   = false;
  lockOverlay.eventMode = "none";
  container.addChild(lockOverlay);

  const centerHit  = new Container();
  centerHit.eventMode = "none";
  centerHit.cursor    = "pointer";
  centerHit.hitArea   = new Rectangle(0, REEL_HEIGHT / 2 - 32, REEL_WIDTH, 64);
  container.addChild(centerHit);

  slot.addChild(container);

  const nudgeDwnY  = CTRL_ABOVE + REEL_HEIGHT + NUDGE_GAP;
  const nudgeDown  = new Container();
  nudgeDown.y         = nudgeDwnY;
  nudgeDown.eventMode = "static";
  nudgeDown.cursor    = "pointer";
  nudgeDown.hitArea   = new Rectangle(CX - HW, 0, HW * 2, NUDGE_H);
  const nudgeDwnGfx   = new Graphics();
  nudgeDwnGfx.poly([CX, NUDGE_H - 2, CX + HW, 2, CX - HW, 2]);
  nudgeDwnGfx.fill({ color: 0x3366cc });
  nudgeDown.addChild(nudgeDwnGfx);
  nudgeDown.on("pointerover", () => { nudgeDwnGfx.tint = 0xaaddff; });
  nudgeDown.on("pointerout",  () => { nudgeDwnGfx.tint = 0xffffff; });
  slot.addChild(nudgeDown);

  const lockBtnY = nudgeDwnY + NUDGE_H + 3;
  const lockBtn  = new Container();
  lockBtn.y         = lockBtnY;
  lockBtn.eventMode = "static";
  lockBtn.cursor    = "pointer";
  lockBtn.hitArea   = new Rectangle(0, 0, REEL_WIDTH, LOCK_H);

  const lockBtnBg = new Graphics();
  lockBtnBg.roundRect(0, 0, REEL_WIDTH, LOCK_H, 3);
  lockBtnBg.fill({ color: 0x1e1e30 });
  lockBtnBg.stroke({ color: 0x404060, width: 1 });
  lockBtn.addChild(lockBtnBg);

  const lockBtnLabel = new Text({ text: "LOCK", style: LOCK_BTN_OFF_STYLE });
  lockBtnLabel.anchor.set(0.5, 0.5);
  lockBtnLabel.x = CX;
  lockBtnLabel.y = LOCK_H / 2;
  lockBtn.addChild(lockBtnLabel);

  lockBtn.on("pointerover", () => { lockBtnBg.tint = 0xbbbbff; });
  lockBtn.on("pointerout",  () => { lockBtnBg.tint = 0xffffff; });
  slot.addChild(lockBtn);

  const nearMissGlow = new Graphics();
  nearMissGlow.roundRect(-3, -3, REEL_WIDTH + 6, REEL_HEIGHT + 6, 8);
  nearMissGlow.stroke({ color: 0xff8800, width: 4 });
  nearMissGlow.roundRect(0, 0, REEL_WIDTH, REEL_HEIGHT, 6);
  nearMissGlow.fill({ color: 0xff8800, alpha: 0.10 });
  nearMissGlow.alpha     = 0;
  nearMissGlow.eventMode = "none";
  container.addChild(nearMissGlow);

  const nearMissLabel = new Text({ text: "", style: NEAR_MISS_LBL_STYLE });
  nearMissLabel.anchor.set(0.5, 0);
  nearMissLabel.x        = CX;
  nearMissLabel.y        = 6;
  nearMissLabel.alpha    = 0;
  nearMissLabel.eventMode = "none";
  container.addChild(nearMissLabel);

  return {
    slot, container, symbolsLayer,
    aboveSprite, centerSprite, belowSprite,
    lockOverlay,
    nudgeUp, nudgeDown,
    lockBtn, lockBtnBg, lockBtnLabel,
    centerHit,
    nearMissGlow, nearMissLabel,
  };
}

function updateReelView(view: ReelView, digits: VisibleDigits): void {
  view.aboveSprite.texture  = getSymbolTexture(digits.below);
  view.centerSprite.texture = getSymbolTexture(digits.center);
  view.belowSprite.texture  = getSymbolTexture(digits.above);
}

function updateLockOverlay(view: ReelView, locked: boolean): void {
  view.lockOverlay.visible = locked;
  view.lockBtnBg.clear();
  view.lockBtnBg.roundRect(0, 0, REEL_WIDTH, LOCK_H, 3);
  if (locked) {
    view.lockBtnBg.fill({ color: 0x3a2200 });
    view.lockBtnBg.stroke({ color: 0xffaa00, width: 1 });
    view.lockBtnLabel.text  = "UNLOCK";
    view.lockBtnLabel.style = LOCK_BTN_ON_STYLE;
  } else {
    view.lockBtnBg.fill({ color: 0x1e1e30 });
    view.lockBtnBg.stroke({ color: 0x404060, width: 1 });
    view.lockBtnLabel.text  = "LOCK";
    view.lockBtnLabel.style = LOCK_BTN_OFF_STYLE;
  }
}

function setCtrlDisabled(c: Container, disabled: boolean): void {
  c.alpha     = disabled ? 0.30 : 1.0;
  c.eventMode = disabled ? "none" : "static";
}

// ═════════════════════════════════════════════════════════════════════════════
async function main() {
  const app = new Application();
  await app.init({
    background:   0x000000,
    resizeTo:     window,
    antialias:    true,
    resolution:   window.devicePixelRatio || 1,
    autoDensity:  true,
    roundPixels:  true,
  });
  document.body.appendChild(app.canvas);

  // ── Loading screen ─────────────────────────────────────────────────────────
  const MIN_DURATION = 1500;
  const startTs      = performance.now();

  const loading = new LoadingScreen(logoUrl());
  loading.layout(app.screen.width, app.screen.height);
  app.stage.addChild(loading);

  const resizeLoading = () => loading.layout(app.screen.width, app.screen.height);
  window.addEventListener("resize", resizeLoading);

  const loaderTick = () => loading.tick(app.ticker.deltaMS);
  app.ticker.add(loaderTick);

  const assetsPromise = loadAssets((p) => loading.setRealProgress(p));

  await new Promise<void>((r) => {
    assetsPromise.then(() => {
      const remaining = Math.max(0, MIN_DURATION - (performance.now() - startTs));
      setTimeout(r, remaining);
    });
  });

  loading.complete();

  await new Promise<void>((r) => {
    const poll = () => loading.isDisplayDone ? r() : requestAnimationFrame(poll);
    requestAnimationFrame(poll);
  });

  app.ticker.remove(loaderTick);
  window.removeEventListener("resize", resizeLoading);
  app.stage.removeChild(loading);
  loading.destroy({ children: true });
  // ── End loading screen ─────────────────────────────────────────────────────

  // ── Rules screen ───────────────────────────────────────────────────────────
  if (!rulesAlreadySeen()) {
    const rules = new RulesScreen();
    rules.layout(app.screen.width, app.screen.height);
    app.stage.addChild(rules);

    const onRulesResize = () => rules.layout(app.screen.width, app.screen.height);
    window.addEventListener("resize", onRulesResize);

    await new Promise<void>((r) => { rules.onPlay = r; });

    window.removeEventListener("resize", onRulesResize);
    app.stage.removeChild(rules);
    rules.destroy({ children: true });
  }
  // ── End rules screen ───────────────────────────────────────────────────────

  const fsm     = new GameStateMachine();
  // Model is seeded with DEFAULT_LEVEL_CONFIG's reel count so the initial view
  // matches.  When a level with a different count starts in the future the
  // model can be rebuilt via rebuildFromSeed() with the new reelCount.
  const model   = new TapeSlotModel(42, undefined, DEFAULT_LEVEL_CONFIG.reelCount);
  const run     = new RunController();
  const cards   = new CardController();
  const economy = new EconomyController();

  // ── Progression ─────────────────────────────────────────────────────────────
  const progression: Progression = loadProgression();
  /** Active level config — updated at the start of each level. */
  let activeLevelConfig = DEFAULT_LEVEL_CONFIG;
  /** Kingdom of the level currently being played. */
  let currentKingdomId   = DEFAULT_LEVEL_CONFIG.kingdomId;
  /** 1-based level number within the current kingdom. */
  let currentLevelNumber = DEFAULT_LEVEL_CONFIG.levelNumber;

  /**
   * Resolved by the FSM "ended" listener with true (all cards claimed) or
   * false (run ended early).  Set at the start of each level and cleared on
   * resolution so it doesn't fire twice.
   */
  let levelEndResolve: ((allClaimed: boolean) => void) | null = null;

  // ══════════════════════════════════════════════════════════════════════════
  // GAME ROOT
  // ══════════════════════════════════════════════════════════════════════════
  const gameRoot = new Container();
  app.stage.addChild(gameRoot);

  // ── cardsBlock — index 0 (behind) ─────────────────────────────────────────
  const CARDS_TOP = PANEL_TOP + RunPanel.PANEL_H + BLOCK_GAP;

  const cardsBlock = new Container();
  cardsBlock.y         = CARDS_TOP;
  cardsBlock.eventMode = "passive";
  gameRoot.addChild(cardsBlock);

  const cardsMask = new Graphics();
  cardsMask.rect(0, 0, CardGrid.GRID_W, CardGrid.TOTAL_H);
  cardsMask.fill(0xffffff);
  cardsBlock.addChild(cardsMask);
  cardsBlock.mask = cardsMask;

  const cardGrid = new CardGrid((cardId) => handleCardClick(cardId), app.ticker);
  cardsBlock.addChild(cardGrid);

  // ── topBlock — index 1 (in front, hit-tested first) ───────────────────────
  const topBlock = new Container();
  gameRoot.addChild(topBlock);

  // ── Level label (left) + Lives display (right) in header area ─────────────
  const levelLabel = new Text({
    text: "Level 1",
    style: new TextStyle({ fontFamily: "Arial, sans-serif", fontSize: 18, fill: 0xffcc00, fontWeight: "bold" }),
  });
  levelLabel.anchor.set(0, 1);
  levelLabel.x = 0;
  levelLabel.y = REEL_SLOT_Y - 4;
  topBlock.addChild(levelLabel);

  const livesDisplay = new LivesDisplay(MAX_LIVES);
  // x is set in layout() after width is known; y aligns bottom to the header line
  livesDisplay.y = REEL_SLOT_Y - 4 - 4;
  topBlock.addChild(livesDisplay);

  // Reels container
  const reelsContainer = new Container();
  reelsContainer.x = Math.round((UI_W - REEL_AREA_WIDTH) / 2);
  reelsContainer.y = REEL_SLOT_Y;
  topBlock.addChild(reelsContainer);

  // Build MAX_REEL_COUNT view slots so that any future level (with more reels)
  // can start without rebuilding the Pixi hierarchy.  Slots beyond the active
  // level's reelCount are hidden by syncReelVisibility().
  const reelViews: ReelView[] = [];
  for (let i = 0; i < MAX_REEL_COUNT; i++) {
    const rv  = createReelView();
    rv.slot.x = i * (REEL_WIDTH + REEL_GAP);
    reelsContainer.addChild(rv.slot);
    reelViews.push(rv);

    const idx = i;
    rv.nudgeUp.on("pointerdown",   (e: FederatedPointerEvent) => { e.stopPropagation(); doNudge(idx, -1); });
    rv.nudgeDown.on("pointerdown", (e: FederatedPointerEvent) => { e.stopPropagation(); doNudge(idx, +1); });
    rv.lockBtn.on("pointerdown",   (e: FederatedPointerEvent) => { e.stopPropagation(); doToggleLock(idx); });
    rv.centerHit.on("pointerdown", (e: FederatedPointerEvent) => { e.stopPropagation(); doToggleLock(idx); });
  }

  /**
   * Show only the reel slots used by the active level config; hide the rest.
   * Call whenever activeLevelConfig changes.
   */
  function syncReelVisibility(): void {
    for (let i = 0; i < reelViews.length; i++) {
      reelViews[i].slot.visible = i < activeLevelConfig.reelCount;
    }
    // Re-centre the reel container for the active reel count.
    const activeAreaW = activeLevelConfig.reelCount * REEL_WIDTH + (activeLevelConfig.reelCount - 1) * REEL_GAP;
    reelsContainer.x  = Math.round((UI_W - activeAreaW) / 2);
  }

  // ── Near-miss reel animation ───────────────────────────────────────────────
  let _nmCancelFn: (() => void) | null = null;

  function showNearMiss(reelIndices: number[], wanted?: string, durationMs = 1400): void {
    if (_nmCancelFn) { _nmCancelFn(); _nmCancelFn = null; }
    for (const rv of reelViews) {
      rv.nearMissGlow.alpha  = 0;
      rv.nearMissLabel.alpha = 0;
    }
    if (reelIndices.length === 0) return;

    const FADE_IN  = 150;
    const FADE_OUT = 400;
    const label    = wanted !== undefined ? `NEED ${wanted}` : "ALMOST";
    for (const idx of reelIndices) {
      const rv = reelViews[idx];
      if (rv) rv.nearMissLabel.text = label;
    }

    const startNM = performance.now();
    const tick = (): void => {
      const elapsed = performance.now() - startNM;
      const hold    = Math.max(0, durationMs - FADE_IN - FADE_OUT);
      let   alpha: number;

      if (elapsed < FADE_IN) {
        alpha = elapsed / FADE_IN;
      } else if (elapsed < FADE_IN + hold) {
        alpha = 1;
      } else if (elapsed < durationMs) {
        alpha = 1 - (elapsed - FADE_IN - hold) / FADE_OUT;
      } else {
        for (const idx of reelIndices) {
          const rv = reelViews[idx];
          if (rv) { rv.nearMissGlow.alpha = 0; rv.nearMissLabel.alpha = 0; }
        }
        app.ticker.remove(tick);
        _nmCancelFn = null;
        return;
      }

      for (const idx of reelIndices) {
        const rv = reelViews[idx];
        if (rv) { rv.nearMissGlow.alpha = alpha; rv.nearMissLabel.alpha = alpha; }
      }
    };

    _nmCancelFn = () => {
      app.ticker.remove(tick);
      for (const idx of reelIndices) {
        const rv = reelViews[idx];
        if (rv) { rv.nearMissGlow.alpha = 0; rv.nearMissLabel.alpha = 0; }
      }
    };
    app.ticker.add(tick);
  }

  // ── RunPanel ────────────────────────────────────────────────────────────────
  const animator       = new ReelAnimator(reelViews, model, app.ticker, getSymbolTexture);
  const spinController = new SpinController(model, fsm, run, animator);

  let endAfterClaim         = false;
  let postClaimSpinRequired = false;

  function doSpin(): void {
    if (fsm.state !== "idle") return;
    if (!run.canSpend(1)) return;

    postClaimSpinRequired = false;

    const hadAvailable = cards.hasAvailable();
    const hadAlmost    = cards.almostShownIds.size > 0;
    if (hadAvailable || hadAlmost) {
      cards.clearAvailable();
      refreshAllCards();
      if (hadAvailable) toast.show("SKIPPED", { duration: 800 });
    }

    spinController.requestSpin(() => {
      const digits = model.getVisibleCenterDigits();
      cards.onSpinResolved(digits);

      refreshAllReels();
      devDrawer.devPanel.refreshInfo();
      if (spinController.lastSpin) devDrawer.devPanel.showLastSpin(spinController.lastSpin.deltas);

      if (run.actions === 0) {
        if (!cards.hasAvailable()) {
          fsm.transition("ended");
        } else {
          endAfterClaim = true;
          toast.show("LAST CLAIM!", { duration: 60_000 });
        }
      } else if (cards.hasAvailable()) {
        toast.show("CHOOSE ONE OR SPIN ANYWAY", { duration: 60_000 });
      } else if (cards.almostShownIds.size > 0) {
        toast.show("SO CLOSE...", { duration: 60_000 });

        const almostCards = CARDS.filter(c => cards.almostShownIds.has(c.id));
        almostCards.sort((a, b) =>
          b.payoutMult - a.payoutMult || b.tier - a.tier || a.id.localeCompare(b.id),
        );
        const best = almostCards[0];
        if (best) {
          const hint = getNearMissHint(best, digits);
          if (hint) showNearMiss(hint.reels, hint.wanted as string | undefined);
        }
      }
    });
  }

  const runPanel = new RunPanel(run, doSpin);
  runPanel.y = PANEL_TOP;
  topBlock.addChild(runPanel);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const toast = new ToastMessage(app.ticker);
  toast.container.x = Math.round(UI_W / 2);
  toast.container.y = CARDS_TOP - 20;
  gameRoot.addChild(toast.container);

  // ── DevDrawer ─────────────────────────────────────────────────────────────
  const devDrawer = new DevDrawer(
    model, fsm, run,
    app.ticker,
    () => { refreshAllReels(); devDrawer.devPanel.refreshInfo(); },
    () => {
      spinController.reset();
      devDrawer.devPanel.clearLastSpin();
      for (let i = 0; i < reelViews.length; i++) updateLockOverlay(reelViews[i], false);
    },
    doSpin,
  );
  devDrawer.devPanel.hideNudgeSection();

  app.stage.addChild(devDrawer.container); // topmost — handle always hittable

  // ── Visibility ──────────────────────────────────────────────────────────────
  function applyVisibility(state: GameState): void {
    const inRun = state !== "betting";

    levelLabel.visible    = inRun;
    livesDisplay.visible  = inRun;
    runPanel.visible      = inRun;
    cardsBlock.visible    = inRun;

    if (!inRun) toast.container.visible = false;
  }

  // ── Per-reel action handlers ────────────────────────────────────────────────

  function doNudge(reelIdx: number, direction: -1 | 1): void {
    if (fsm.state !== "idle") return;
    if (postClaimSpinRequired) {
      toast.show("Spin to unlock new card", { duration: 1500 });
      return;
    }
    const cost = run.getNudgeCost();
    if (!run.canSpend(cost)) return;
    run.spend(cost);
    run.recordNudge();
    model.reels[reelIdx].nudge(direction);
    refreshAllReels();
    refreshCardsFromCurrentDigits();
    devDrawer.devPanel.refreshInfo();
    if (run.actions === 0) fsm.transition("ended");
  }

  function doToggleLock(reelIdx: number): void {
    if (fsm.state !== "idle") return;
    if (postClaimSpinRequired) {
      toast.show("Spin to unlock new card", { duration: 1500 });
      return;
    }
    const alreadyLocked = model.isLocked(reelIdx);
    if (!alreadyLocked) {
      if (model.lockedCount() >= 2) {
        toast.show("Max 2 holds", { duration: 1500 });
        return;
      }
      if (!run.canSpend(run.getLockCost())) return;
      run.spend(run.getLockCost());
    }
    model.toggleLocked(reelIdx);
    updateLockOverlay(reelViews[reelIdx], model.isLocked(reelIdx));
    devDrawer.devPanel.refreshInfo();
    refreshAllCards();
    syncReelControls(fsm.state);
  }

  function syncReelControls(state: GameState): void {
    const nudgeCost = run.getNudgeCost();
    const canNudge  = state === "idle" && run.canSpend(nudgeCost) && !postClaimSpinRequired;
    const lockBase  = state === "idle" && !postClaimSpinRequired;

    for (let i = 0; i < reelViews.length; i++) {
      const rv       = reelViews[i];
      const isLocked = model.isLocked(i);
      const canLock  = lockBase && (isLocked || (run.canSpend(run.getLockCost()) && model.lockedCount() < 2));
      setCtrlDisabled(rv.nudgeUp,   !canNudge);
      setCtrlDisabled(rv.nudgeDown, !canNudge);
      setCtrlDisabled(rv.lockBtn,   !canLock);
      rv.centerHit.eventMode = canLock ? "static" : "none";
    }
  }

  // ── Game handlers ───────────────────────────────────────────────────────────

  function handleStartRun(): void {
    if (fsm.state !== "betting") return;

    endAfterClaim         = false;
    postClaimSpinRequired = false;
    run.configure(economy.anteEnabled);
    run.resetRun();
    economy.resetRun();
    cards.resetRun();
    model.resetOffsets();
    model.resetLocks();
    spinController.reset();
    devDrawer.devPanel.clearLastSpin();
    for (let i = 0; i < reelViews.length; i++) updateLockOverlay(reelViews[i], false);

    fsm.transition("idle");

    refreshAllReels();
    devDrawer.devPanel.refreshInfo();
    doSpin();
  }

  // ── Card helpers ────────────────────────────────────────────────────────────

  function refreshAllCards(): void {
    cardGrid.updateCards(cards.availableIds, cards.claimedIds, cards.almostShownIds);
    cardGrid.updateSummary(cards.claimedIds.size);
    runPanel.refresh(cards.claimedIds.size);
  }

  function refreshCardsFromCurrentDigits(): void {
    const digits = model.getVisibleCenterDigits();
    cards.onDigitsChanged(digits);
    refreshAllCards();
  }

  function handleCardClick(cardId: string): void {
    const s = fsm.state;
    if (s === "running" || s === "resolve" || s === "betting") return;
    if (!cards.canClaim(cardId)) return;

    if (_nmCancelFn) { _nmCancelFn(); _nmCancelFn = null; }

    const { payoutMult, tier } = cards.claimOne(cardId);
    economy.addWin(payoutMult);

    if (tier >= 4) {
      run.addActions(1);
      if (s === "ended" && run.actions > 0) fsm.transition("idle");
    }

    refreshAllCards();
    cardGrid.flashClaimAnimation(cardId);

    model.resetLocks();
    for (let i = 0; i < reelViews.length; i++) updateLockOverlay(reelViews[i], false);

    postClaimSpinRequired = true;
    syncReelControls(fsm.state);

    if (endAfterClaim) {
      endAfterClaim = false;
      if (run.actions === 0) {
        devDrawer.devPanel.refreshInfo();
        syncReelControls(fsm.state);
        fsm.transition("ended");
        return;
      }
    }

    toast.show("LOCKS CLEARED  •  SPIN TO CONTINUE", { duration: 1200 });

    devDrawer.devPanel.refreshInfo();
    syncReelControls(fsm.state);
  }

  // ── FSM listener ─────────────────────────────────────────────────────────────
  fsm.onChange((_, next) => {
    devDrawer.devPanel.syncState(next);
    devDrawer.devPanel.refreshInfo();
    runPanel.syncState(next);
    syncReelControls(next);

    const animating = next === "running" || next === "resolve";
    cardGrid.setSpin(animating);
    devDrawer.setSpinLocked(animating);

    applyVisibility(next);

    // Level end detection — resolve the promise waited on by runGameLoop.
    if (next === "ended" && levelEndResolve) {
      const allClaimed = cards.claimedIds.size === CARDS.length;
      const resolve    = levelEndResolve;
      levelEndResolve  = null;
      // Slight delay so the FSM state fully settles before the game loop acts.
      setTimeout(() => resolve(allClaimed), 80);
    }
  });

  // ── Refresh helpers ──────────────────────────────────────────────────────────
  function refreshAllReels(): void {
    // Only refresh slots used by the active level; extras are hidden.
    for (let i = 0; i < activeLevelConfig.reelCount; i++) {
      updateReelView(reelViews[i], model.reels[i].getVisible());
      updateLockOverlay(reelViews[i], model.isLocked(i));
    }
    refreshAllCards();
    syncReelControls(fsm.state);
  }

  // ── Result popup ─────────────────────────────────────────────────────────────
  /**
   * Shows a centred modal with `message`, waits for the player to click
   * "Continue", then destroys itself and resolves.
   */
  function showResultPopup(message: string, isSuccess: boolean): Promise<void> {
    return new Promise<void>((resolve) => {
      const OW = 360, OH = 170;

      const popup = new Container();

      const popBg = new Graphics();
      popBg.roundRect(0, 0, OW, OH, 10);
      popBg.fill({ color: 0x0a0a20, alpha: 0.97 });
      popBg.stroke({ color: isSuccess ? 0x44cc44 : 0xff4444, width: 2 });
      popBg.eventMode = "none";
      popup.addChild(popBg);

      const msgText = new Text({
        text: message,
        style: new TextStyle({
          fontFamily: "Arial, sans-serif",
          fontSize:   20,
          fill:       isSuccess ? 0x44ff88 : 0xff6666,
          fontWeight: "bold",
          align:      "center",
          wordWrap:   true,
          wordWrapWidth: OW - 40,
        }),
      });
      msgText.anchor.set(0.5, 0.5);
      msgText.x = OW / 2;
      msgText.y = OH / 2 - 22;
      popup.addChild(msgText);

      const btnW = 200, btnH = 36;
      const btn  = new Container();
      btn.eventMode = "static";
      btn.cursor    = "pointer";

      const bBg = new Graphics();
      bBg.roundRect(0, 0, btnW, btnH, 6);
      bBg.fill({ color: 0x333366 });
      bBg.stroke({ color: 0x6666cc, width: 2 });
      btn.addChild(bBg);

      const bTxt = new Text({
        text: "Continue",
        style: new TextStyle({ fontFamily: "Arial, sans-serif", fontSize: 14, fill: 0xffffff, fontWeight: "bold" }),
      });
      bTxt.anchor.set(0.5, 0.5);
      bTxt.x = btnW / 2;
      bTxt.y = btnH / 2;
      btn.addChild(bTxt);

      btn.x = Math.round((OW - btnW) / 2);
      btn.y = OH - btnH - 18;
      btn.on("pointerdown", (e: FederatedPointerEvent) => {
        e.stopPropagation();
        app.stage.removeChild(popup);
        popup.destroy({ children: true });
        resolve();
      });
      btn.on("pointerover", () => { bBg.tint = 0xaaaaff; });
      btn.on("pointerout",  () => { bBg.tint = 0xffffff; });
      popup.addChild(btn);

      // Position: scale-aware centring on screen
      const w   = window.innerWidth;
      const h   = window.innerHeight;
      const cfg = computeLayout(w, h);
      const s   = cfg.scale;
      popup.scale.set(s);
      popup.x = Math.round((w - OW * s) / 2);
      popup.y = Math.round((h - OH * s) / 2);

      app.stage.addChild(popup);
    });
  }

  // ── Layout ──────────────────────────────────────────────────────────────────
  function layout(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const cfg = computeLayout(w, h);

    gameRoot.x = cfg.rootX;
    gameRoot.y = cfg.rootY;
    gameRoot.scale.set(cfg.scale);

    devDrawer.resize(w, h);

    // Lives display: right-align within header area
    livesDisplay.x = UI_W - Math.round(livesDisplay.width);

    rulesBtn.x = w - RBTN_SIZE - 8;
    rulesBtn.y = 8;
  }

  // ── "?" rules button ─────────────────────────────────────────────────────────
  const rulesBtn        = new Container();
  rulesBtn.eventMode    = "static";
  rulesBtn.cursor       = "pointer";

  const rulesBtnBg = new Graphics();
  const RBTN_SIZE  = 28;
  rulesBtnBg.roundRect(0, 0, RBTN_SIZE, RBTN_SIZE, 6);
  rulesBtnBg.fill({ color: 0x1a1a3a });
  rulesBtnBg.stroke({ color: 0x3a3a6a, width: 1 });
  rulesBtn.addChild(rulesBtnBg);

  const rulesBtnTxt = new Text({
    text: "?",
    style: new TextStyle({ fontFamily: "Arial, sans-serif", fontSize: 16, fill: 0x7777cc, fontWeight: "bold" }),
  });
  rulesBtnTxt.anchor.set(0.5, 0.5);
  rulesBtnTxt.x = RBTN_SIZE / 2;
  rulesBtnTxt.y = RBTN_SIZE / 2;
  rulesBtn.addChild(rulesBtnTxt);

  rulesBtn.on("pointerover", () => { rulesBtnBg.tint = 0xaaaaff; });
  rulesBtn.on("pointerout",  () => { rulesBtnBg.tint = 0xffffff; });
  rulesBtn.on("pointerdown", (e: FederatedPointerEvent) => {
    e.stopPropagation();
    const overlay = new RulesScreen();
    overlay.layout(app.screen.width, app.screen.height);
    app.stage.addChild(overlay);
    const onR = () => overlay.layout(app.screen.width, app.screen.height);
    window.addEventListener("resize", onR);
    overlay.onPlay = () => {
      window.removeEventListener("resize", onR);
      app.stage.removeChild(overlay);
      overlay.destroy({ children: true });
    };
  });
  app.stage.addChild(rulesBtn);

  // ── Boot ────────────────────────────────────────────────────────────────────
  refreshAllReels();
  devDrawer.devPanel.refreshInfo();
  devDrawer.devPanel.syncState(fsm.state);
  runPanel.syncState(fsm.state);

  applyVisibility(fsm.state); // starts "betting" — game UI hidden
  syncReelControls(fsm.state);
  syncReelVisibility();       // hide reel slots beyond the default level's count

  layout();
  window.addEventListener("resize", layout);

  // ── Main game loop ──────────────────────────────────────────────────────────
  // Runs forever: Level Select → play level → handle result → repeat.
  void runGameLoop();

  async function runGameLoop(): Promise<void> {
    while (true) {
      // ── Show Level Select ──────────────────────────────────────────────────
      const unlockedSet = new Set(progression.unlockedLevelIds);
      const levelSelect = new LevelSelectScreen(unlockedSet);
      levelSelect.layout(app.screen.width, app.screen.height);
      app.stage.addChild(levelSelect);

      const onLSResize = () => levelSelect.layout(app.screen.width, app.screen.height);
      window.addEventListener("resize", onLSResize);

      const { kingdomId, levelNumber } = await new Promise<{ kingdomId: string; levelNumber: number }>(
        (r) => { levelSelect.onLevelSelected = (k, l) => r({ kingdomId: k, levelNumber: l }); },
      );

      window.removeEventListener("resize", onLSResize);
      app.stage.removeChild(levelSelect);
      levelSelect.destroy({ children: true });

      // ── Configure active level ─────────────────────────────────────────────
      currentKingdomId   = kingdomId;
      currentLevelNumber = levelNumber;
      activeLevelConfig  = getLevelConfig(`${kingdomId}-${levelNumber}`);

      levelLabel.text = `Level ${levelNumber}`;
      livesDisplay.setLives(progression.lives);

      // Apply reel visibility / layout for this level's reel count.
      syncReelVisibility();

      // Configure economy (internal only — not shown to player).
      economy.setBaseBet(10);
      economy.setAnteEnabled(false);

      // Arm the level-end resolver before starting (FSM must be in "betting").
      const allClaimed = await new Promise<boolean>((r) => {
        levelEndResolve = r;
        handleStartRun(); // transitions betting → idle, auto-spins
      });

      // ── Evaluate result ────────────────────────────────────────────────────
      if (allClaimed) {
        // Success: unlock next level in this kingdom (sequential).
        const nextLevelNumber = currentLevelNumber + 1;
        const nextKey         = `${currentKingdomId}-${nextLevelNumber}`;
        const kingdomName     = KINGDOM_NAMES[currentKingdomId] ?? currentKingdomId;

        let successMsg: string;
        if (nextLevelNumber <= LEVELS_PER_KINGDOM) {
          if (!progression.unlockedLevelIds.includes(nextKey)) {
            progression.unlockedLevelIds = [...progression.unlockedLevelIds, nextKey];
            saveProgression(progression);
          }
          successMsg = `Level ${nextLevelNumber} unlocked!`;
        } else {
          // All levels in this kingdom complete — no cross-kingdom unlock yet.
          successMsg = `${kingdomName} complete!`;
        }

        await showResultPopup(successMsg, true);

      } else {
        // Failure: lose one life.
        progression.lives = Math.max(0, progression.lives - 1);
        saveProgression(progression);
        livesDisplay.setLives(progression.lives);

        if (progression.lives <= 0) {
          await showResultPopup("No lives left", false);
          progression.lives = MAX_LIVES;
          saveProgression(progression);
        } else {
          await showResultPopup("Level failed", false);
        }
      }

      // Return FSM to "betting" for the next loop iteration.
      if (fsm.state === "ended") {
        fsm.transition("betting");
      }
    }
  }
}

main();
