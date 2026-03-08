import {
  Container,
  Graphics,
  Text,
  TextStyle,
  FederatedPointerEvent,
} from "pixi.js";
import {
  KINGDOM_ORDER,
  KINGDOM_NAMES,
  LEVELS_PER_KINGDOM,
} from "../config/levelConfigs";

// ── Layout ────────────────────────────────────────────────────────────────────
const PANEL_W   = 480;
const TILE_W    = 210;
const TILE_H    = 58;
const TILE_GAP  = 12;
const TILE_COLS = 2;

// ── Text styles ───────────────────────────────────────────────────────────────
const TITLE_STYLE = new TextStyle({
  fontFamily: "Arial, sans-serif",
  fontSize:   26,
  fill:       0xffcc00,
  fontWeight: "bold",
  letterSpacing: 3,
});

const KINGDOM_STYLE = new TextStyle({
  fontFamily: "Arial, sans-serif",
  fontSize:   13,
  fill:       0x8899cc,
  fontWeight: "bold",
  letterSpacing: 2,
});

const BTN_STYLE = new TextStyle({
  fontFamily: "Arial, sans-serif",
  fontSize:   15,
  fill:       0xffffff,
  fontWeight: "bold",
});

const LOCKED_STYLE = new TextStyle({
  fontFamily: "Arial, sans-serif",
  fontSize:   15,
  fill:       0x444466,
});

const LOCK_SUB_STYLE = new TextStyle({
  fontFamily: "Arial, sans-serif",
  fontSize:   10,
  fill:       0x333355,
});

// ─────────────────────────────────────────────────────────────────────────────
export class LevelSelectScreen extends Container {
  /**
   * Fired when the player taps an unlocked level tile.
   * Receives the kingdom id (e.g. "cards") and 1-based level number.
   */
  onLevelSelected: ((kingdomId: string, levelNumber: number) => void) | null = null;

  private _bg:     Graphics;
  private _panel:  Container;
  private _panelW: number;
  private _panelH: number;

  constructor(unlockedLevelIds: ReadonlySet<string>) {
    super();
    this.eventMode = "static"; // blocks clicks falling through to the game

    this._bg = new Graphics();
    this._bg.eventMode = "none";
    this.addChild(this._bg);

    // ── Panel height: title + one section per kingdom ────────────────────────
    const PAD         = 22;
    const TITLE_H     = 42;
    const KH_H        = 26;   // kingdom header text height
    const KH_GAP      = 10;   // space below header text before tiles
    const K_ROWS      = Math.ceil(LEVELS_PER_KINGDOM / TILE_COLS);
    const K_GRID_H    = K_ROWS * TILE_H + (K_ROWS - 1) * TILE_GAP;
    const K_SECTION_H = KH_H + KH_GAP + K_GRID_H;
    const K_SEP       = 24;   // vertical gap between kingdom sections

    this._panelW = PANEL_W;
    this._panelH =
      PAD + TITLE_H + 16 +
      KINGDOM_ORDER.length * K_SECTION_H +
      (KINGDOM_ORDER.length - 1) * K_SEP +
      PAD;

    this._panel = new Container();
    this.addChild(this._panel);

    this._buildPanel(unlockedLevelIds);
  }

  private _buildPanel(unlockedLevelIds: ReadonlySet<string>): void {
    const PW = this._panelW;
    const PH = this._panelH;

    // Panel background
    const panelBg = new Graphics();
    panelBg.roundRect(0, 0, PW, PH, 12);
    panelBg.fill({ color: 0x07071a, alpha: 0.97 });
    panelBg.stroke({ color: 0x3a3a6a, width: 2 });
    panelBg.eventMode = "none";
    this._panel.addChild(panelBg);

    // Title
    const title = new Text({ text: "Select Level", style: TITLE_STYLE });
    title.anchor.set(0.5, 0);
    title.x = PW / 2;
    title.y = 20;
    this._panel.addChild(title);

    const gridW    = TILE_COLS * TILE_W + (TILE_COLS - 1) * TILE_GAP;
    const gridLeft = Math.round((PW - gridW) / 2);

    let curY = 20 + 42 + 16; // below title

    for (const kingdomId of KINGDOM_ORDER) {
      const kingdomName = KINGDOM_NAMES[kingdomId] ?? kingdomId;

      // ── Kingdom header ───────────────────────────────────────────────────
      const kHeader = new Text({
        text:  kingdomName.toUpperCase(),
        style: KINGDOM_STYLE,
      });
      kHeader.x = gridLeft;
      kHeader.y = curY;
      this._panel.addChild(kHeader);

      // Divider line
      const div = new Graphics();
      div.rect(gridLeft, curY + kHeader.height + 4, gridW, 1);
      div.fill({ color: 0x22224a });
      div.eventMode = "none";
      this._panel.addChild(div);

      curY += kHeader.height + 10;

      // ── Level tiles ──────────────────────────────────────────────────────
      for (let i = 0; i < LEVELS_PER_KINGDOM; i++) {
        const levelNumber = i + 1;
        const col         = i % TILE_COLS;
        const row         = Math.floor(i / TILE_COLS);
        const tx          = gridLeft + col * (TILE_W + TILE_GAP);
        const ty          = curY + row * (TILE_H + TILE_GAP);
        const levelKey    = `${kingdomId}-${levelNumber}`;
        const unlocked    = unlockedLevelIds.has(levelKey);

        this._buildTile(tx, ty, `Level ${levelNumber}`, kingdomId, levelNumber, unlocked);
      }

      const rows = Math.ceil(LEVELS_PER_KINGDOM / TILE_COLS);
      curY += rows * TILE_H + (rows - 1) * TILE_GAP + 24;
    }
  }

  private _buildTile(
    tx: number, ty: number,
    label: string,
    kingdomId: string, levelNumber: number,
    unlocked: boolean,
  ): void {
    const tile = new Container();
    tile.x         = tx;
    tile.y         = ty;
    tile.eventMode = unlocked ? "static" : "none";
    tile.cursor    = unlocked ? "pointer" : "default";
    this._panel.addChild(tile);

    const tileBg = new Graphics();
    tileBg.roundRect(0, 0, TILE_W, TILE_H, 8);
    if (unlocked) {
      tileBg.fill({ color: 0x1a3a1a });
      tileBg.stroke({ color: 0x44cc44, width: 2 });
    } else {
      tileBg.fill({ color: 0x0d0d20 });
      tileBg.stroke({ color: 0x1e1e38, width: 1 });
    }
    tile.addChild(tileBg);

    const lbl = new Text({ text: label, style: unlocked ? BTN_STYLE : LOCKED_STYLE });
    lbl.anchor.set(0.5, 0.5);
    lbl.x = TILE_W / 2;
    lbl.y = unlocked ? TILE_H / 2 : TILE_H / 2 - 8;
    tile.addChild(lbl);

    if (!unlocked) {
      const subLbl = new Text({ text: "locked", style: LOCK_SUB_STYLE });
      subLbl.anchor.set(0.5, 0);
      subLbl.x = TILE_W / 2;
      subLbl.y = TILE_H / 2 + 6;
      tile.addChild(subLbl);
    }

    if (unlocked) {
      tile.on("pointerdown", (e: FederatedPointerEvent) => {
        e.stopPropagation();
        this.onLevelSelected?.(kingdomId, levelNumber);
      });
      tile.on("pointerover", () => { tileBg.tint = 0xaaffaa; });
      tile.on("pointerout",  () => { tileBg.tint = 0xffffff; });
    }
  }

  /** Recentre when the canvas resizes. */
  layout(canvasW: number, canvasH: number): void {
    this._bg.clear();
    this._bg.rect(0, 0, canvasW, canvasH);
    this._bg.fill({ color: 0x000000, alpha: 0.88 });

    this._panel.x = Math.round((canvasW - this._panelW) / 2);
    this._panel.y = Math.round((canvasH - this._panelH) / 2);
  }
}
