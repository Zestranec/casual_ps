import { Container, Text, TextStyle } from "pixi.js";

// ── Text styles ───────────────────────────────────────────────────────────────
const ACTIVE_STYLE = new TextStyle({
  fontFamily: "Arial, sans-serif", fontSize: 20, fill: 0xff3355,
});
const INACTIVE_STYLE = new TextStyle({
  fontFamily: "Arial, sans-serif", fontSize: 20, fill: 0x3a1122,
});
const LABEL_STYLE = new TextStyle({
  fontFamily: "Arial, sans-serif", fontSize: 13, fill: 0x9999bb,
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Horizontal row of heart icons representing the player's remaining lives.
 * Active hearts are bright red; lost hearts are dimmed.
 */
export class LivesDisplay extends Container {
  private _maxLives: number;
  private _hearts:   Text[] = [];

  constructor(maxLives = 3) {
    super();
    this._maxLives = maxLives;
    this._build();
  }

  private _build(): void {
    const label = new Text({ text: "Lives:", style: LABEL_STYLE });
    label.y = 2;
    this.addChild(label);

    let x = Math.round(label.width) + 8;
    for (let i = 0; i < this._maxLives; i++) {
      const heart = new Text({ text: "♥", style: ACTIVE_STYLE });
      heart.x = x;
      heart.y = 0;
      this.addChild(heart);
      this._hearts.push(heart);
      x += Math.round(heart.width) + 3;
    }
  }

  /** Update visible heart count. Excess hearts are dimmed. */
  setLives(lives: number): void {
    for (let i = 0; i < this._maxLives; i++) {
      this._hearts[i].style = i < lives ? ACTIVE_STYLE : INACTIVE_STYLE;
    }
  }
}
