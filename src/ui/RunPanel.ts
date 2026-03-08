import {
  Container,
  Graphics,
  Text,
  TextStyle,
  FederatedPointerEvent,
} from "pixi.js";
import { GameState } from "../core/GameStateMachine";
import { RunController } from "../game/RunController";

// ─────────────────────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────────────────────
const PANEL_W    = 700;
const SPIN_BTN_W = 116;
const SPIN_BTN_H = 60;
const PANEL_H    = SPIN_BTN_H + 28; // 88

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const HUD_LABEL = new TextStyle({ fontFamily: "Arial, sans-serif", fontSize: 13, fill: 0x9999bb });
const HUD_VAL   = new TextStyle({ fontFamily: "Arial, sans-serif", fontSize: 13, fill: 0xffffff, fontWeight: "bold" });
const ACT_OK    = new TextStyle({ fontFamily: "Arial, sans-serif", fontSize: 13, fill: 0x44ff88, fontWeight: "bold" });
const ACT_LOW   = new TextStyle({ fontFamily: "Arial, sans-serif", fontSize: 13, fill: 0xff9944, fontWeight: "bold" });
const ACT_ZERO  = new TextStyle({ fontFamily: "Arial, sans-serif", fontSize: 13, fill: 0xff2222, fontWeight: "bold" });
const SPIN_TXT  = new TextStyle({ fontFamily: "Arial, sans-serif", fontSize: 22, fill: 0xffffff, fontWeight: "bold" });

// ─────────────────────────────────────────────────────────────────────────────

function setDisabled(c: Container, disabled: boolean): void {
  c.alpha     = disabled ? 0.35 : 1.0;
  c.eventMode = disabled ? "none" : "static";
  c.cursor    = disabled ? "default" : "pointer";
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * RunPanel — compact HUD + SPIN button shown below the reels during a run.
 *
 * Layout (PANEL_W = 700):
 *   Left column  (x=14):   Claimed / Actions rows
 *   Right column (x=572):  tall SPIN button
 */
export class RunPanel extends Container {
  static readonly PANEL_H = PANEL_H;

  private run: RunController;
  private onSpin: () => void;

  private claimedText!: Text;
  private actionsText!: Text;
  private spinBtn!:     Container;
  private spinBg!:      Graphics;

  private _lastState:  GameState = "betting";
  private _spinBlocked = false;

  constructor(run: RunController, onSpin: () => void) {
    super();
    this.run    = run;
    this.onSpin = onSpin;
    this.build();
  }

  // ── Build ──────────────────────────────────────────────────────────────────
  private build(): void {
    const X = 14;

    const bg = new Graphics();
    bg.roundRect(0, 0, PANEL_W, PANEL_H, 8);
    bg.fill({ color: 0x16162e, alpha: 0.95 });
    bg.stroke({ color: 0x36365a, width: 1 });
    bg.eventMode = "none";
    this.addChild(bg);

    // ── HUD rows (left of SPIN button) ────────────────────────────────────
    const SPIN_AREA_LEFT = PANEL_W - SPIN_BTN_W - X; // 572
    const ROW1_Y = Math.round((PANEL_H / 2) - 14);
    const ROW2_Y = ROW1_Y + 26;

    // Row 1: Claimed
    this.addChild(Object.assign(new Text({ text: "Claimed:", style: HUD_LABEL }), { x: X, y: ROW1_Y }));
    this.claimedText = Object.assign(new Text({ text: "0 / 20", style: HUD_VAL }), { x: X + 70, y: ROW1_Y });
    this.addChild(this.claimedText);

    // Row 2: Actions
    this.addChild(Object.assign(new Text({ text: "Actions:", style: HUD_LABEL }), { x: X, y: ROW2_Y }));
    this.actionsText = Object.assign(new Text({ text: "—", style: ACT_OK }), { x: X + 70, y: ROW2_Y });
    this.addChild(this.actionsText);

    // Thin vertical divider before spin button
    const div = new Graphics();
    div.moveTo(0, 8); div.lineTo(0, PANEL_H - 8);
    div.stroke({ color: 0x3a3a5a, width: 1 });
    div.x = SPIN_AREA_LEFT - 14;
    this.addChild(div);

    // ── SPIN button ──────────────────────────────────────────────────────
    this.spinBtn = new Container();
    this.spinBtn.x = SPIN_AREA_LEFT;
    this.spinBtn.y = Math.round((PANEL_H - SPIN_BTN_H) / 2);
    this.spinBtn.eventMode = "static";
    this.spinBtn.cursor    = "pointer";

    this.spinBg = new Graphics();
    this.spinBg.roundRect(0, 0, SPIN_BTN_W, SPIN_BTN_H, 8);
    this.spinBg.fill({ color: 0x1a4a1a });
    this.spinBg.stroke({ color: 0x44cc44, width: 2 });
    this.spinBtn.addChild(this.spinBg);

    const spinLabel = new Text({ text: "SPIN", style: SPIN_TXT });
    spinLabel.anchor.set(0.5);
    spinLabel.x = SPIN_BTN_W / 2;
    spinLabel.y = SPIN_BTN_H / 2;
    this.spinBtn.addChild(spinLabel);

    this.spinBtn.on("pointerdown", (e: FederatedPointerEvent) => { e.stopPropagation(); this.onSpin(); });
    this.spinBtn.on("pointerover", () => { this.spinBg.tint = 0x88ff88; });
    this.spinBtn.on("pointerout",  () => { this.spinBg.tint = 0xffffff; });
    this.addChild(this.spinBtn);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Update displayed values. Called after every reel refresh and claim. */
  refresh(claimedCount: number): void {
    this.claimedText.text = `${claimedCount} / 20`;

    const acts = this.run.actions;
    const max  = this.run.maxActions;
    this.actionsText.text  = `${acts} / ${max}`;
    this.actionsText.style =
      acts === 0 ? ACT_ZERO :
      acts <= 4  ? ACT_LOW  :
                   ACT_OK;
  }

  /** Enable / disable SPIN based on FSM state. */
  syncState(state: GameState): void {
    this._lastState = state;
    this._updateSpin();
  }

  /**
   * Block or unblock SPIN independently of FSM state.
   * Set true when available cards exist (player must claim one first).
   */
  setSpinBlocked(blocked: boolean): void {
    this._spinBlocked = blocked;
    this._updateSpin();
  }

  private _updateSpin(): void {
    const disabled = this._lastState !== "idle" || this._spinBlocked;
    setDisabled(this.spinBtn, disabled);
  }
}
