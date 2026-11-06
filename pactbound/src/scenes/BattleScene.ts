import Phaser from 'phaser';
import { sound } from '../audio/sound';
import { Battle, type BattleEvent, type Outcome, type PlayerAction, type Side } from '../battle/engine';
import { GAME_H, GAME_W, UI } from '../config';
import { displayName, evolve, isFainted, maxHp, pendingEvolution, replaceMove, xpProgress, type Familiar } from '../core/familiar';
import { session } from '../core/session';
import { addFamiliar, itemCount, markSeen, removeItem } from '../core/state';
import { ARCANA_INFO, type Arcana } from '../data/arcana';
import { ITEMS, ITEM_IDS, type ItemId } from '../data/items';
import { MOVES, STATUS_INFO, type MoveId } from '../data/moves';
import { SPECIES } from '../data/species';
import { personFrame } from '../gfx/people';
import { famKey, personKey } from '../gfx/textures';
import { controls } from '../input/controls';
import type { BattleRequest } from '../story/api';
import { addText, drawBar, drawPanel, hpColor, nextFrame, tweenAsync, waitSeconds } from '../ui/kit';
import { ListMenu } from '../ui/ListMenu';
import { PartyPanel } from '../ui/PartyPanel';
import type { BattleBg } from '../world/types';

export interface BattleSceneData extends BattleRequest {
  bg: BattleBg;
  onDone: (outcome: Outcome) => void;
}

const GROUND_Y = 214;
const POS: Record<Side, { x: number; y: number }> = { player: { x: 124, y: GROUND_Y }, foe: { x: 356, y: GROUND_Y } };
const MSG_Y = 236;

/**
 * The duel stage: both familiars face each other on rune circles, the HUD
 * sits along the top, messages and commands along the bottom. All the rules
 * live in battle/engine.ts; this scene only plays its events back.
 */
export class BattleScene extends Phaser.Scene {
  private req!: BattleSceneData;
  private battle!: Battle;
  private sprites!: Record<Side, Phaser.GameObjects.Image>;
  private hud!: Phaser.GameObjects.Graphics;
  private hudText!: Record<Side, { name: Phaser.GameObjects.Text; lv: Phaser.GameObjects.Text; types: Phaser.GameObjects.Text; status: Phaser.GameObjects.Text; hp: Phaser.GameObjects.Text }>;
  private shownHp: Record<Side, number> = { player: 0, foe: 0 };
  private shownXp = 0;
  private msgG!: Phaser.GameObjects.Graphics;
  private msg!: Phaser.GameObjects.Text;
  private trainer: Phaser.GameObjects.Sprite | null = null;
  private wren!: Phaser.GameObjects.Sprite;

  constructor() {
    super('Battle');
  }

  init(data: BattleSceneData): void {
    this.req = data;
  }

  create(): void {
    const s = session.state;
    const req = this.req;
    for (const f of req.foe) markSeen(s, f.species);
    this.battle = new Battle({
      kind: req.kind,
      player: s.party,
      foe: req.foe,
      trainerName: req.trainerName,
      ai: req.ai,
      heartbloom: true,
    });
    this.drawBackground(req.bg);
    this.sprites = {
      player: this.add.image(POS.player.x, POS.player.y, famKey(this.battle.playerActive.species)).setOrigin(0.5, 1).setScale(2).setFlipX(true).setVisible(false),
      foe: this.add.image(POS.foe.x, POS.foe.y, famKey(this.battle.foeActive.species)).setOrigin(0.5, 1).setScale(2).setVisible(false),
    };
    this.hud = this.add.graphics().setDepth(50);
    const mk = (x: number) => ({
      name: addText(this, x + 9, 11, '').setDepth(51),
      lv: addText(this, x + 199, 11, '', { color: UI.textDim }).setOrigin(1, 0).setDepth(51),
      types: addText(this, x + 9, 28, '').setDepth(51),
      status: addText(this, x + 120, 28, '').setDepth(51),
      hp: addText(this, x + 199, 28, '', { color: UI.textDim }).setOrigin(1, 0).setDepth(51),
    });
    this.hudText = { player: mk(8), foe: mk(GAME_W - 216) };
    this.msgG = this.add.graphics().setDepth(60);
    drawPanel(this.msgG, 6, MSG_Y, GAME_W - 12, 78);
    this.msg = addText(this, 20, MSG_Y + 10, '', { wrap: GAME_W - 44, lineSpacing: 5 }).setDepth(61);
    this.wren = this.add.sprite(POS.player.x - 10, GROUND_Y, personKey('wren'), personFrame('right', 0)).setOrigin(0.5, 1).setScale(3).setDepth(5);
    if (req.kind === 'trainer' && req.trainerLook) {
      this.trainer = this.add.sprite(POS.foe.x + 10, GROUND_Y, personKey(req.trainerLook), personFrame('left', 0)).setOrigin(0.5, 1).setScale(3).setDepth(5);
    }
    this.cameras.main.fadeIn(250);
    controls.flush();
    void this.run();
  }

  // ── Background ──────────────────────────────────────────────────────────

  private drawBackground(bg: BattleBg): void {
    const g = this.add.graphics().setDepth(-10);
    const bands = (colors: number[], y0: number, y1: number) => {
      const h = (y1 - y0) / colors.length;
      colors.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, Math.floor(y0 + i * h), GAME_W, Math.ceil(h) + 1));
    };
    const night = session.state.flags.time === 'night';
    if (bg === 'courtyard') {
      bands(night ? [0x0c0d26, 0x14163a, 0x1c1e48, 0x262656] : [0x2a1c48, 0x3e2658, 0x5e3466, 0x8a4a6a, 0xb8686a], 0, 150);
      g.fillStyle(0x1a1426, 1);
      for (const [x, w, h] of [[20, 50, 70], [90, 34, 96], [140, 60, 60], [300, 70, 84], [380, 40, 110], [430, 60, 66]] as const) {
        g.fillRect(x, 150 - h, w, h);
        g.fillTriangle(x - 4, 150 - h, x + w / 2, 150 - h - 22, x + w + 4, 150 - h);
        g.fillStyle(0xf6d98a, 0.85);
        for (let wy = 150 - h + 10; wy < 140; wy += 18) g.fillRect(x + w / 2 - 2, wy, 4, 7);
        g.fillStyle(0x1a1426, 1);
      }
      bands([0x5e5866, 0x6c6672, 0x7a737e, 0x847d88], 150, GAME_H);
      g.fillStyle(0x4c4652, 1);
      for (let y = 160; y < GAME_H; y += 16) g.fillRect(0, y, GAME_W, 1);
    } else if (bg === 'forest') {
      bands(night ? [0x080c18, 0x0e1424, 0x141c30, 0x1a2438] : [0x1a2438, 0x22304a, 0x2c3e58, 0x384c62], 0, 150);
      for (let layer = 0; layer < 3; layer++) {
        g.fillStyle([0x101a20, 0x16242a, 0x1e3034][layer] as number, 1);
        for (let x = -20 + layer * 23; x < GAME_W + 40; x += 46) {
          const h = 70 + ((x * 7 + layer * 13) % 40);
          g.fillTriangle(x - 22, 150, x, 150 - h, x + 22, 150);
        }
      }
      bands([0x2a3e30, 0x30463a, 0x364c3e, 0x3a5244], 150, GAME_H);
      g.fillStyle(0xd8d0ff, 0.08);
      for (let i = 0; i < 4; i++) g.fillRect(0, 120 + i * 22, GAME_W, 8);
    } else if (bg === 'hall') {
      bands([0x120e18, 0x18121e, 0x1e1726, 0x241c2e], 0, 150);
      g.fillStyle(0x2e2638, 1);
      for (let x = 20; x < GAME_W; x += 110) {
        g.fillRect(x, 20, 18, 130);
        g.fillRect(x + 72, 20, 18, 130);
        g.fillStyle(0x1a1420, 1).fillEllipse(x + 54, 64, 54, 70);
        g.fillStyle(0x2e2638, 1);
      }
      for (const x of [60, 420]) {
        g.fillStyle(0xf6d98a, 0.12).fillCircle(x, 90, 34);
        g.fillStyle(0xf6d98a, 0.25).fillCircle(x, 90, 16);
        g.fillStyle(0xfff2c4, 1).fillRect(x - 1, 86, 3, 6);
      }
      bands([0x3c3644, 0x443d4c, 0x4c4454, 0x544c5c], 150, GAME_H);
      g.lineStyle(2, 0x9a72e0, 0.5).strokeEllipse(GAME_W / 2, 206, 420, 70);
    } else if (bg === 'glasshouse') {
      bands([0x8ec4d8, 0x9ccfe0, 0xaad8e6, 0xb8e0ea], 0, 150);
      g.fillStyle(0xe4eee6, 1);
      for (let x = 0; x < GAME_W; x += 60) g.fillRect(x, 0, 3, 150);
      for (let y = 30; y < 150; y += 40) g.fillRect(0, y, GAME_W, 2);
      for (let x = -10; x < GAME_W + 20; x += 34) {
        g.fillStyle(0x3f7a45, 1).fillEllipse(x, 140, 46, 40);
        g.fillStyle(0x5a9a5a, 1).fillEllipse(x + 8, 132, 26, 22);
        g.fillStyle(0xf2a7bf, 1).fillRect(x + 4, 126, 3, 3);
      }
      bands([0x6c6772, 0x75707c, 0x7e7986, 0x87828e], 150, GAME_H);
      g.fillStyle(0x4a4650, 1);
      for (let y = 166; y < GAME_H; y += 16) g.fillRect(0, y, GAME_W, 1);
    } else {
      bands([0x2c1e18, 0x342420, 0x3c2a24, 0x44302a], 0, 150);
      const books = [0x8a3a4a, 0x3d5a8a, 0x4a7a4a, 0xc9a24a, 0x6a4a8a];
      for (let x = 10; x < GAME_W; x += 60) {
        g.fillStyle(0x24160f, 1).fillRect(x, 20, 50, 130);
        for (let y = 30; y < 150; y += 24) {
          for (let bx = x + 4; bx < x + 46; bx += 5) {
            g.fillStyle(books[(bx * 3 + y) % books.length] as number, 0.8).fillRect(bx, y, 4, 18 - ((bx + y) % 5));
          }
          g.fillStyle(0x3e2817, 1).fillRect(x, y + 19, 50, 3);
        }
      }
      bands([0x6f4a30, 0x7a5236, 0x845a3c, 0x8a5f3f], 150, GAME_H);
    }
    // Rune platforms.
    for (const side of ['player', 'foe'] as const) {
      const { x } = POS[side];
      g.fillStyle(0x000000, 0.28).fillEllipse(x, GROUND_Y - 2, 120, 26);
      g.lineStyle(2, side === 'player' ? 0xf2a7bf : 0xb48cf0, 0.55).strokeEllipse(x, GROUND_Y - 2, 112, 22);
      g.lineStyle(1, 0xffffff, 0.15).strokeEllipse(x, GROUND_Y - 2, 92, 16);
    }
  }

  // ── HUD ─────────────────────────────────────────────────────────────────

  private drawHud(): void {
    const g = this.hud;
    g.clear();
    for (const side of ['player', 'foe'] as const) {
      const f = this.battle.active(side);
      const x = side === 'player' ? 8 : GAME_W - 216;
      const visible = this.sprites[side].visible;
      const t = this.hudText[side];
      for (const o of Object.values(t)) o.setVisible(visible);
      if (!visible) continue;
      const h = side === 'player' ? 64 : 58;
      drawPanel(g, x, 6, 208, h);
      const max = maxHp(f);
      const frac = this.shownHp[side] / max;
      drawBar(g, x + 8, 48, 192, 7, frac, hpColor(frac));
      if (side === 'player') drawBar(g, x + 8, 57, 192, 4, this.shownXp, UI.xp);
      t.name.setText(displayName(f));
      t.lv.setText(`Lv${f.level}`);
      const types = SPECIES[f.species].types;
      t.types.setText(types.map((a) => ARCANA_INFO[a].name).join('/'));
      t.types.setColor(`#${ARCANA_INFO[types[0] as Arcana].color.toString(16).padStart(6, '0')}`);
      t.status.setText(f.status ? STATUS_INFO[f.status].short : '');
      if (f.status) t.status.setColor(`#${STATUS_INFO[f.status].color.toString(16).padStart(6, '0')}`);
      t.hp.setText(side === 'player' ? `${Math.ceil(this.shownHp[side])}/${max}` : '');
    }
  }

  private async tweenHp(side: Side, to: number): Promise<void> {
    const from = this.shownHp[side];
    const ms = Math.min(900, 250 + Math.abs(from - to) * 18);
    const proxy = { v: from };
    await tweenAsync(this, {
      targets: proxy,
      v: to,
      duration: ms,
      onUpdate: () => {
        this.shownHp[side] = proxy.v;
        this.drawHud();
      },
    });
    this.shownHp[side] = to;
    this.drawHud();
  }

  // ── Messages ────────────────────────────────────────────────────────────

  private setMessage(text: string, wrapNarrow = false): void {
    this.msg.setWordWrapWidth(wrapNarrow ? 290 : GAME_W - 44);
    this.msg.setText(text);
  }

  /** Types a battle message. It moves on by itself unless `waitForA`. A skips either way. */
  private async message(text: string, waitForA = false): Promise<void> {
    this.setMessage('');
    let shown = 0;
    let acc = 0;
    while (shown < text.length) {
      const dt = await nextFrame(this);
      if (controls.consume('a') || controls.consume('b')) shown = text.length;
      acc += dt * 90;
      const n = Math.floor(acc);
      acc -= n;
      shown = Math.min(text.length, shown + n);
      this.msg.setText(text.slice(0, shown));
    }
    this.msg.setText(text);
    let t = 0;
    const hold = waitForA ? Infinity : Math.min(2.2, 0.75 + text.length * 0.018);
    while (t < hold) {
      t += await nextFrame(this);
      if (t > 0.08 && (controls.consume('a') || controls.consume('b'))) break;
    }
  }

  // ── Main loop ───────────────────────────────────────────────────────────

  private async run(): Promise<void> {
    await this.intro();
    await this.play(this.battle.begin());
    while (!this.battle.outcome) {
      if (this.battle.mustSwitch) {
        const idx = await this.pickFamiliar('Who will you send out?', false);
        await this.play(this.battle.replace(idx));
        continue;
      }
      const action = await this.chooseAction();
      if (action.kind === 'item') removeItem(session.state, action.item);
      await this.play(this.battle.act(action));
    }
    await this.finish(this.battle.outcome);
  }

  private async intro(): Promise<void> {
    const foe = this.sprites.foe;
    if (this.trainer) {
      this.trainer.x = GAME_W + 30;
      await tweenAsync(this, { targets: this.trainer, x: POS.foe.x + 10, duration: 450, ease: 'Quad.easeOut' });
    } else {
      foe.setVisible(true).setX(GAME_W + 60);
      this.shownHp.foe = this.battle.foeActive.hp;
      await tweenAsync(this, { targets: foe, x: POS.foe.x, duration: 500, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: foe, scaleY: 2.08, duration: 160, yoyo: true });
    }
    this.wren.x = -30;
    await tweenAsync(this, { targets: this.wren, x: POS.player.x - 10, duration: 400, ease: 'Quad.easeOut' });
  }

  private async play(events: BattleEvent[]): Promise<void> {
    for (const e of events) {
      switch (e.t) {
        case 'text':
          await this.message(e.text);
          break;
        case 'sendOut':
          await this.sendOut(e.side);
          break;
        case 'recall':
          await this.recall(e.side);
          break;
        case 'cast':
          await this.castAnim(e.side, e.move);
          break;
        case 'damage':
          await this.hitAnim(e.side, e.effectiveness, e.crit, e.amount);
          await this.tweenHp(e.side, e.hp);
          break;
        case 'heal':
          sound.sfx('heal');
          this.burst(this.sprites[e.side].x, this.sprites[e.side].y - 40, 0x9ef0b0, 14, 30, -1);
          await this.tweenHp(e.side, e.hp);
          break;
        case 'miss':
          sound.sfx('miss');
          await tweenAsync(this, { targets: this.sprites[e.side === 'player' ? 'foe' : 'player'], x: `+=${e.side === 'player' ? 14 : -14}`, duration: 90, yoyo: true });
          break;
        case 'status':
          this.drawHud();
          if (e.status) {
            this.burst(this.sprites[e.side].x, this.sprites[e.side].y - 40, STATUS_INFO[e.status].color, 16, 34, 0);
            sound.sfx('statDown');
            await waitSeconds(this, 0.25);
          }
          break;
        case 'stat': {
          const spr = this.sprites[e.side];
          sound.sfx(e.change > 0 ? 'statUp' : 'statDown');
          this.arrows(spr.x, spr.y - 40, e.change > 0);
          await waitSeconds(this, 0.45);
          break;
        }
        case 'faint': {
          const spr = this.sprites[e.side];
          sound.sfx('faint');
          await tweenAsync(this, { targets: spr, y: spr.y + 30, alpha: 0, duration: 450, ease: 'Quad.easeIn' });
          spr.setVisible(false).setAlpha(1).setY(POS[e.side].y);
          this.drawHud();
          break;
        }
        case 'sigil':
          await this.sigilAnim(e.shakes, e.success);
          break;
        case 'xp':
          if (e.index === this.battle.player.active) await this.tweenXp(this.battle.player.party[e.index] as Familiar);
          break;
        case 'levelUp': {
          sound.sfx('levelUp');
          if (e.index === this.battle.player.active) {
            const f = this.battle.playerActive;
            this.shownHp.player = f.hp;
            this.shownXp = 0;
            this.drawHud();
            this.cameras.main.flash(180, 255, 240, 200);
          }
          break;
        }
        case 'learned':
          break;
        case 'learnPrompt':
          await this.learnPrompt(this.battle.player.party[e.index] as Familiar, e.move);
          break;
        case 'end':
          break;
      }
    }
  }

  private async tweenXp(f: Familiar): Promise<void> {
    const to = xpProgress(f);
    const proxy = { v: this.shownXp };
    await tweenAsync(this, {
      targets: proxy,
      v: to < this.shownXp ? 1 : to,
      duration: 500,
      onUpdate: () => {
        this.shownXp = proxy.v;
        this.drawHud();
      },
    });
    this.shownXp = to;
    this.drawHud();
  }

  // ── Animations ──────────────────────────────────────────────────────────

  private async sendOut(side: Side): Promise<void> {
    const f = this.battle.active(side);
    const spr = this.sprites[side];
    if (side === 'foe' && this.trainer?.visible) {
      await tweenAsync(this, { targets: this.trainer, x: GAME_W + 40, duration: 300, ease: 'Quad.easeIn' });
      this.trainer.setVisible(false);
    }
    if (side === 'player' && this.wren.visible) {
      await tweenAsync(this, { targets: this.wren, x: -40, duration: 300, ease: 'Quad.easeIn' });
      this.wren.setVisible(false);
    }
    if (side === 'foe' && spr.visible && spr.texture.key === famKey(f.species) && this.req.kind === 'wild') {
      this.drawHud();
      return;
    }
    spr.setTexture(famKey(f.species)).setVisible(true).setAlpha(1).setScale(0).setPosition(POS[side].x, POS[side].y);
    this.shownHp[side] = f.hp;
    if (side === 'player') this.shownXp = xpProgress(f);
    this.burst(POS[side].x, POS[side].y - 30, side === 'player' ? 0xf2a7bf : 0xb48cf0, 18, 40, 0);
    sound.sfx('confirm');
    await tweenAsync(this, { targets: spr, scale: 2, duration: 280, ease: 'Back.easeOut' });
    this.drawHud();
  }

  private async recall(side: Side): Promise<void> {
    const spr = this.sprites[side];
    spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    await tweenAsync(this, { targets: spr, scale: 0, duration: 260, ease: 'Quad.easeIn' });
    spr.clearTint().setTintMode(Phaser.TintModes.MULTIPLY).setVisible(false).setScale(2);
    this.drawHud();
  }

  private async castAnim(side: Side, id: MoveId): Promise<void> {
    const mv = MOVES[id];
    const color = ARCANA_INFO[mv.type].color;
    const user = this.sprites[side];
    const target = this.sprites[side === 'player' ? 'foe' : 'player'];
    const dir = side === 'player' ? 1 : -1;
    if (mv.power > 0) {
      await tweenAsync(this, { targets: user, x: user.x + 18 * dir, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
      this.projectile(user.x + 30 * dir, user.y - 40, target.x, target.y - 40, color, mv.type);
      await waitSeconds(this, 0.22);
    } else {
      const selfOnly = (mv.effects ?? []).every((e) => e.kind === 'heal' || (e.kind === 'stat' && e.target === 'self'));
      sound.sfx('sigil');
      user.setTint(color).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(140, () => user.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
      if (selfOnly) this.burst(user.x, user.y - 30, color, 16, 36, -1);
      else this.projectile(user.x, user.y - 40, target.x, target.y - 40, color, mv.type);
      await waitSeconds(this, 0.35);
    }
  }

  private async hitAnim(side: Side, eff: number, crit: boolean, amount: number): Promise<void> {
    const spr = this.sprites[side];
    sound.sfx(eff > 1 || crit ? 'hitStrong' : eff < 1 ? 'hitWeak' : 'hit');
    if (eff > 1 || crit) this.cameras.main.shake(180, 0.008);
    for (let i = 0; i < 3; i++) {
      spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      await waitSeconds(this, 0.05);
      spr.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      await waitSeconds(this, 0.05);
    }
    const label = addText(this, spr.x, spr.y - 100, `-${amount}`, { color: eff > 1 ? '#ffd27a' : '#ffffff', stroke: '#120d18' })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({ targets: label, y: label.y - 16, alpha: 0, duration: 700, onComplete: () => label.destroy() });
  }

  /** Particles that fly from the caster to the target, flavoured by arcana. */
  private projectile(x0: number, y0: number, x1: number, y1: number, color: number, type: Arcana): void {
    const n = type === 'gale' ? 8 : 12;
    for (let i = 0; i < n; i++) {
      const isHeart = type === 'heart';
      const p = isHeart
        ? this.add.image(x0, y0, 'icon:heart').setScale(1)
        : this.add.image(x0, y0, 'pixel').setScale(type === 'stone' ? 4 : 3).setTint(i % 3 === 0 ? 0xffffff : color);
      p.setDepth(30);
      const jitter = (k: number) => (Math.random() - 0.5) * k;
      this.tweens.add({
        targets: p,
        x: x1 + jitter(30),
        y: y1 + jitter(type === 'stone' ? 10 : 30) + (type === 'stone' ? 10 : 0),
        delay: i * 18,
        duration: 220 + Math.random() * 80,
        ease: type === 'umbra' ? 'Quad.easeIn' : 'Linear',
        onComplete: () => {
          this.tweens.add({ targets: p, alpha: 0, scale: 0, duration: 160, onComplete: () => p.destroy() });
        },
      });
    }
    if (type === 'lumen') this.cameras.main.flash(120, 255, 248, 210);
  }

  /** A puff of particles. `rise` -1 floats upward, 0 bursts outward. */
  private burst(x: number, y: number, color: number, n: number, radius: number, rise: number): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = this.add.image(x, y, 'pixel').setScale(3).setTint(i % 4 === 0 ? 0xffffff : color).setDepth(30);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * radius * (rise ? 0.5 : 1),
        y: y + Math.sin(a) * radius * (rise ? 0.4 : 1) + rise * 30,
        alpha: 0,
        duration: 500 + Math.random() * 200,
        onComplete: () => p.destroy(),
      });
    }
  }

  private arrows(x: number, y: number, up: boolean): void {
    for (let i = 0; i < 6; i++) {
      const t = addText(this, x - 30 + i * 12, y + (up ? 20 : -20), up ? '^' : 'v', { color: up ? '#9fe8ff' : '#ff9a9a' }).setDepth(30);
      this.tweens.add({ targets: t, y: t.y + (up ? -30 : 30), alpha: 0, delay: i * 40, duration: 420, onComplete: () => t.destroy() });
    }
  }

  private async sigilAnim(shakes: number, success: boolean): Promise<void> {
    const foe = this.sprites.foe;
    const ring = this.add.graphics().setDepth(20);
    const draw = (r: number, alpha: number) => {
      ring.clear();
      ring.lineStyle(2, 0xf0d488, alpha).strokeEllipse(POS.foe.x, GROUND_Y - 4, r * 2, r * 0.5);
      ring.lineStyle(1, 0xfff2c4, alpha * 0.8).strokeEllipse(POS.foe.x, GROUND_Y - 4, r * 1.5, r * 0.36);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ring.fillStyle(0xf0d488, alpha).fillRect(POS.foe.x + Math.cos(a) * r * 0.85 - 1, GROUND_Y - 4 + Math.sin(a) * r * 0.21 - 1, 3, 3);
      }
    };
    const proxy = { r: 0 };
    sound.sfx('sigil');
    await tweenAsync(this, { targets: proxy, r: 56, duration: 350, onUpdate: () => draw(proxy.r, 1) });
    foe.setTint(0xfff2c4).setTintMode(Phaser.TintModes.FILL);
    await tweenAsync(this, { targets: foe, scale: 0, duration: 300, ease: 'Quad.easeIn' });
    for (let i = 0; i < shakes; i++) {
      await waitSeconds(this, 0.35);
      sound.sfx('sigil');
      await tweenAsync(this, { targets: proxy, r: 64, duration: 140, yoyo: true, onUpdate: () => draw(proxy.r, 1) });
    }
    await waitSeconds(this, 0.3);
    if (success) {
      sound.sfx('caught');
      this.burst(POS.foe.x, GROUND_Y - 20, 0xf0d488, 24, 50, -1);
      await tweenAsync(this, { targets: proxy, r: 90, duration: 400, onUpdate: () => draw(proxy.r, 1 - proxy.r / 90) });
    } else {
      sound.sfx('broke');
      foe.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      await tweenAsync(this, { targets: foe, scale: 2, duration: 220, ease: 'Back.easeOut' });
    }
    ring.destroy();
  }

  // ── Player choices ──────────────────────────────────────────────────────

  private async chooseAction(): Promise<PlayerAction> {
    for (;;) {
      const f = this.battle.playerActive;
      this.setMessage(`What will ${displayName(f)} do?`, true);
      const cmd = new ListMenu(this, {
        x: GAME_W - 168,
        y: MSG_Y,
        w: 162,
        cols: 2,
        rowH: 30,
        items: [{ label: 'Cast' }, { label: 'Bag' }, { label: 'Team' }, { label: 'Flee', disabled: this.req.kind === 'trainer' }],
        depth: 70,
      });
      const c = await cmd.pick(false);
      cmd.destroy();
      if (c === 0) {
        const slot = await this.chooseMove(f, 'cast');
        if (slot >= 0) return { kind: 'move', slot };
      } else if (c === 1) {
        const action = await this.chooseItem();
        if (action) return action;
      } else if (c === 2) {
        const idx = await this.pickFamiliar('Switch to which familiar?', true);
        if (idx >= 0) {
          if (this.battle.canSwitchTo(idx)) return { kind: 'switch', index: idx };
          await this.message(idx === this.battle.player.active ? 'That familiar is already out!' : 'That familiar is too tired to fight!');
        }
      } else if (c === 3) {
        return { kind: 'flee' };
      }
    }
  }

  /** Returns a move slot, or -1 to go back. */
  private async chooseMove(f: Familiar, mode: 'cast' | 'forget'): Promise<number> {
    const info = addText(this, GAME_W - 150, MSG_Y + 10, '', { lineSpacing: 5 }).setDepth(72);
    const infoG = this.add.graphics().setDepth(71);
    drawPanel(infoG, GAME_W - 162, MSG_Y, 156, 78);
    const items = f.moves.map((m) => ({ label: MOVES[m.id].name }));
    const menu = new ListMenu(this, { x: 6, y: MSG_Y, w: GAME_W - 170, cols: 2, rowH: 30, items, depth: 70 });
    const describe = (i: number) => {
      const slot = f.moves[i];
      if (!slot) return;
      const mv = MOVES[slot.id];
      info.setText(`${ARCANA_INFO[mv.type].name}\nUses ${slot.uses}/${mv.uses}\n${mv.power > 0 ? `Power ${mv.power}` : 'Status'}`);
      info.setColor(`#${ARCANA_INFO[mv.type].color.toString(16).padStart(6, '0')}`);
    };
    describe(0);
    menu.onMove = describe;
    let result = -1;
    for (;;) {
      const i = await menu.pick(true);
      if (i < 0) break;
      const slot = f.moves[i];
      if (mode === 'cast' && slot && slot.uses <= 0 && f.moves.some((m) => m.uses > 0)) {
        sound.sfx('bump');
        continue;
      }
      result = i;
      break;
    }
    menu.destroy();
    info.destroy();
    infoG.destroy();
    return result;
  }

  private async chooseItem(): Promise<PlayerAction | null> {
    const s = session.state;
    const usable = ITEM_IDS.filter((id) => itemCount(s, id) > 0 && ITEMS[id].kind !== 'key' && (ITEMS[id].kind !== 'sigil' || this.req.kind === 'wild'));
    if (usable.length === 0) {
      await this.message(this.req.kind === 'wild' ? 'The bag is empty!' : 'Nothing in the bag will help in a duel.');
      return null;
    }
    const menu = new ListMenu(this, {
      x: GAME_W - 250,
      y: 8,
      w: 244,
      rows: Math.min(6, usable.length + 1),
      items: [...usable.map((id) => ({ label: ITEMS[id].name, right: `x${itemCount(s, id)}` })), { label: 'Back' }],
      depth: 80,
    });
    const describe = (i: number) => this.setMessage(i < usable.length ? ITEMS[usable[i] as ItemId].desc : '');
    describe(0);
    menu.onMove = describe;
    const i = await menu.pick(true);
    menu.destroy();
    if (i < 0 || i >= usable.length) return null;
    const id = usable[i] as ItemId;
    if (ITEMS[id].kind === 'sigil') return { kind: 'item', item: id };
    const target = await this.pickFamiliar(`Use the ${ITEMS[id].name} on whom?`, true);
    if (target < 0) return null;
    const f = s.party[target] as Familiar;
    if (isFainted(f)) {
      await this.message(`${displayName(f)} is too tired for that to help.`);
      return null;
    }
    return { kind: 'item', item: id, target };
  }

  private async pickFamiliar(title: string, cancelable: boolean): Promise<number> {
    const party = session.state.party;
    const active = this.battle.player.active;
    // When a replacement is required, start on the first familiar that can actually fight.
    const initial = cancelable ? active : Math.max(0, party.findIndex((f, i) => !isFainted(f) && i !== active));
    const panel = new PartyPanel(this, party, title, 90, initial);
    for (;;) {
      const i = await panel.pick(cancelable);
      if (i < 0) {
        panel.destroy();
        return -1;
      }
      const f = session.state.party[i] as Familiar;
      if (!cancelable && (isFainted(f) || i === this.battle.player.active)) {
        sound.sfx('bump');
        continue;
      }
      panel.destroy();
      return i;
    }
  }

  private async yesNo(question: string): Promise<boolean> {
    this.setMessage(question, true);
    const menu = new ListMenu(this, { x: GAME_W - 120, y: MSG_Y - 52, w: 114, items: [{ label: 'Yes' }, { label: 'No' }], depth: 80 });
    const i = await menu.pick(true);
    menu.destroy();
    return i === 0;
  }

  private async learnPrompt(f: Familiar, move: MoveId): Promise<void> {
    const name = displayName(f);
    const mv = MOVES[move].name;
    await this.message(`${name} wants to learn ${mv}, but it already knows four spells.`, true);
    if (await this.yesNo(`Forget a spell to make room for ${mv}?`)) {
      this.setMessage(`Which spell should ${name} forget?`, true);
      const slot = await this.chooseMove(f, 'forget');
      if (slot >= 0) {
        const old = MOVES[(f.moves[slot] as { id: MoveId }).id].name;
        replaceMove(f, slot, move);
        sound.sfx('levelUp');
        await this.message(`1, 2, and... poof! ${name} forgot ${old} and learned ${mv}!`, true);
        return;
      }
    }
    await this.message(`${name} did not learn ${mv}.`, true);
  }

  // ── Wrapping up ─────────────────────────────────────────────────────────

  private async finish(outcome: Outcome): Promise<void> {
    const s = session.state;
    const req = this.req;
    if (req.kind === 'trainer' && (outcome === 'win' || outcome === 'lose') && this.trainer) {
      this.trainer.setVisible(true).setX(GAME_W + 40);
      await tweenAsync(this, { targets: this.trainer, x: POS.foe.x + 10, duration: 400, ease: 'Quad.easeOut' });
      const line = outcome === 'win' ? req.loseLine : req.winLine;
      if (line) await this.message(`${req.trainerName}: ${line}`, true);
    }
    if (outcome === 'win' && req.reward) {
      s.marks += req.reward;
      sound.sfx('item');
      await this.message(`Wren received ${req.reward} marks.`, true);
    }
    if (outcome === 'caught' && this.battle.caught) {
      const f = this.battle.caught;
      const where = addFamiliar(s, f);
      await this.message(where === 'party' ? `${displayName(f)} joined Wren's familiars!` : `${displayName(f)} went to wait in the Conservatory.`, true);
    }
    if (outcome === 'win' || outcome === 'caught') {
      for (const f of s.party) {
        const to = pendingEvolution(f);
        if (to && !isFainted(f)) await this.ascend(f, to);
      }
    }
    await new Promise<void>((r) => {
      this.cameras.main.fadeOut(300);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => r());
    });
    this.req.onDone(outcome);
  }

  private async ascend(f: Familiar, to: (typeof f)['species']): Promise<void> {
    const before = displayName(f);
    for (const side of ['player', 'foe'] as const) this.sprites[side].setVisible(false);
    this.drawHud();
    const spr = this.add.image(GAME_W / 2, GROUND_Y - 6, famKey(f.species)).setOrigin(0.5, 1).setScale(2).setFlipX(true).setDepth(25);
    await this.message(`What? ${before} is ascending!`, true);
    sound.sfx('ascend');
    let delay = 0.32;
    for (let i = 0; i < 12; i++) {
      spr.setTexture(famKey(i % 2 === 0 ? to : f.species)).setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      await waitSeconds(this, delay);
      delay = Math.max(0.05, delay * 0.78);
    }
    evolve(f, to);
    spr.setTexture(famKey(to)).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    this.cameras.main.flash(300, 255, 255, 255);
    this.burst(GAME_W / 2, GROUND_Y - 50, 0xf0d488, 28, 70, -1);
    sound.sfx('caught');
    await this.message(`${before} ascended into ${SPECIES[to].name}!`, true);
    spr.destroy();
  }
}
