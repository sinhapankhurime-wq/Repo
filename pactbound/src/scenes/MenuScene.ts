import Phaser from 'phaser';
import { sound } from '../audio/sound';
import { GAME_H, GAME_W, TITLE_FONT_CSS, UI } from '../config';
import { displayName, healHp, isFainted, maxHp, stats, xpForLevel, MAX_LEVEL, type Familiar } from '../core/familiar';
import { saveGame } from '../core/save';
import { session } from '../core/session';
import { itemCount, removeItem } from '../core/state';
import { ARCANA_INFO } from '../data/arcana';
import { ITEMS, ITEM_IDS, type ItemId } from '../data/items';
import { MOVES, STATUS_INFO } from '../data/moves';
import { SPECIES, SPECIES_IDS } from '../data/species';
import { famKey } from '../gfx/textures';
import { controls } from '../input/controls';
import { addText, drawPanel, nextFrame } from '../ui/kit';
import { ListMenu } from '../ui/ListMenu';
import { PartyPanel } from '../ui/PartyPanel';

export interface MenuSceneData {
  onClose: () => void;
}

/** The pause menu, opened with Esc / MENU from the overworld. */
export class MenuScene extends Phaser.Scene {
  private onClose!: () => void;
  private footG!: Phaser.GameObjects.Graphics;
  private foot!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  init(data: MenuSceneData): void {
    this.onClose = data.onClose;
  }

  create(): void {
    controls.flush();
    this.footG = this.add.graphics().setDepth(10);
    this.foot = addText(this, 20, GAME_H - 66, '', { wrap: GAME_W - 40 }).setDepth(11);
    void this.main();
  }

  private footer(text: string): void {
    this.footG.clear();
    this.foot.setText(text);
    if (text) drawPanel(this.footG, 6, GAME_H - 78, GAME_W - 12, 72);
  }

  private async waitAny(): Promise<void> {
    for (;;) {
      await nextFrame(this);
      if (controls.consume('a') || controls.consume('b') || controls.consume('menu')) return;
    }
  }

  private async main(): Promise<void> {
    const options = ['Familiars', 'Bag', 'Journal', 'Save', 'Sound', 'Close'];
    const menu = new ListMenu(this, { x: GAME_W - 142, y: 6, w: 136, items: options.map((label) => ({ label })), depth: 20 });
    const hints = [
      'Check on your familiars and change their order.',
      'Use tonics and remedies, or read about key items.',
      'Your current objective, and how things stand with Lucien.',
      'Save your story to this browser.',
      'Turn music and sound effects on or off.',
      'Back to Thornveil.',
    ];
    menu.onMove = (i) => this.footer(hints[i] ?? '');
    this.footer(hints[0] as string);
    for (;;) {
      await nextFrame(this);
      if (controls.consume('menu')) break;
      const i = menu.poll(true);
      if (i === null) continue;
      if (i === -1 || i === 5) break;
      menu.setVisible(false);
      if (i === 0) await this.familiars();
      else if (i === 1) await this.bag();
      else if (i === 2) await this.journal();
      else if (i === 3) await this.save();
      else if (i === 4) await this.soundMenu();
      menu.setVisible(true);
      this.footer(hints[menu.index] ?? '');
    }
    menu.destroy();
    sound.sfx('cancel');
    this.scene.stop();
    this.onClose();
  }

  private async familiars(): Promise<void> {
    const party = session.state.party;
    for (;;) {
      this.footer('');
      const panel = new PartyPanel(this, party, 'Familiars', 30);
      const i = await panel.pick(true);
      panel.destroy();
      if (i < 0) return;
      const sub = new ListMenu(this, {
        x: GAME_W - 152,
        y: 170,
        w: 146,
        items: [{ label: 'Summary' }, { label: 'Move up', disabled: i === 0 }, { label: 'Back' }],
        depth: 40,
      });
      const c = await sub.pick(true);
      sub.destroy();
      if (c === 0) await this.summary(party[i] as Familiar);
      else if (c === 1 && i > 0) {
        [party[i - 1], party[i]] = [party[i] as Familiar, party[i - 1] as Familiar];
        sound.sfx('confirm');
      }
    }
  }

  private async summary(f: Familiar): Promise<void> {
    const g = this.add.graphics().setDepth(50);
    drawPanel(g, 6, 6, GAME_W - 12, GAME_H - 12);
    const sp = SPECIES[f.species];
    const objs: Phaser.GameObjects.GameObject[] = [g];
    objs.push(this.add.image(84, 132, famKey(f.species)).setOrigin(0.5, 1).setScale(2).setFlipX(true).setDepth(51));
    const st = stats(f);
    const next = f.level >= MAX_LEVEL ? 0 : xpForLevel(sp.growth, f.level + 1) - f.xp;
    const lines: [number, number, string, string?][] = [
      [160, 16, `${displayName(f)}   Lv ${f.level}`, UI.textGold],
      [160, 36, sp.types.map((t) => ARCANA_INFO[t].name).join(' / '), `#${ARCANA_INFO[sp.types[0]!].color.toString(16).padStart(6, '0')}`],
      [160, 58, `HP     ${f.hp}/${maxHp(f)}${f.status ? `   ${STATUS_INFO[f.status].name}` : isFainted(f) ? '   Fainted' : ''}`],
      [160, 76, `Power  ${st.pow}`],
      [160, 94, `Guard  ${st.grd}`],
      [160, 112, `Speed  ${st.spd}`],
      [310, 76, f.level >= MAX_LEVEL ? 'Max level' : `Next level: ${next} XP`, UI.textDim],
      [310, 94, sp.evolves ? `Ascends at Lv ${sp.evolves.level}` : '', UI.textDim],
    ];
    for (const [x, y, text, color] of lines) objs.push(addText(this, x, y, text, { color }).setDepth(51));
    f.moves.forEach((m, k) => {
      const mv = MOVES[m.id];
      objs.push(
        addText(this, 24 + (k % 2) * 226, 148 + Math.floor(k / 2) * 22, `${mv.name}`, {
          color: `#${ARCANA_INFO[mv.type].color.toString(16).padStart(6, '0')}`,
        }).setDepth(51),
        addText(this, 222 + (k % 2) * 226, 148 + Math.floor(k / 2) * 22, `${m.uses}/${mv.uses}`, { color: UI.textDim })
          .setOrigin(1, 0)
          .setDepth(51),
      );
    });
    objs.push(addText(this, 24, 204, sp.dex, { wrap: GAME_W - 48, color: '#d8cce6' }).setDepth(51));
    await this.waitAny();
    sound.sfx('cancel');
    for (const o of objs) o.destroy();
  }

  private async bag(): Promise<void> {
    const s = session.state;
    for (;;) {
      const owned = ITEM_IDS.filter((id) => itemCount(s, id) > 0);
      const menu = new ListMenu(this, {
        x: 6,
        y: 6,
        w: 280,
        rows: Math.max(1, Math.min(8, owned.length + 1)),
        items: [...owned.map((id) => ({ label: ITEMS[id].name, right: ITEMS[id].kind === 'key' ? '' : `x${itemCount(s, id)}` })), { label: 'Back' }],
        depth: 30,
      });
      const marks = addText(this, GAME_W - 16, 14, `Marks: ${s.marks}`, { color: UI.textGold }).setOrigin(1, 0).setDepth(31);
      const describe = (i: number) => this.footer(i < owned.length ? ITEMS[owned[i] as ItemId].desc : owned.length ? '' : 'Your bag is empty.');
      describe(0);
      menu.onMove = describe;
      const i = await menu.pick(true);
      menu.destroy();
      marks.destroy();
      if (i < 0 || i >= owned.length) return;
      const id = owned[i] as ItemId;
      const def = ITEMS[id];
      if (def.kind === 'sigil') {
        this.footer('Trace a sigil during a battle with a wild familiar to offer it your pact.');
        await this.waitAny();
        continue;
      }
      if (def.kind === 'key') {
        this.footer(def.desc);
        await this.waitAny();
        continue;
      }
      this.footer(`Use the ${def.name} on which familiar?`);
      const panel = new PartyPanel(this, s.party, def.name, 40);
      const t = await panel.pick(true);
      panel.destroy();
      if (t < 0) continue;
      const f = s.party[t] as Familiar;
      let msg: string;
      if (isFainted(f)) msg = `${displayName(f)} is too tired. A rest in bed will help.`;
      else if (def.kind === 'heal') {
        const n = healHp(f, def.heal ?? 0);
        if (n > 0) {
          removeItem(s, id);
          sound.sfx('heal');
          msg = `${displayName(f)} recovered ${n} HP.`;
        } else msg = 'It would have no effect.';
      } else if (f.status) {
        f.status = null;
        f.statusTurns = 0;
        removeItem(s, id);
        sound.sfx('heal');
        msg = `${displayName(f)} feels much better.`;
      } else msg = 'It would have no effect.';
      this.footer(msg);
      await this.waitAny();
    }
  }

  private async journal(): Promise<void> {
    const s = session.state;
    const g = this.add.graphics().setDepth(30);
    drawPanel(g, 6, 6, GAME_W - 12, GAME_H - 12);
    const objs: Phaser.GameObjects.GameObject[] = [g];
    const t = (x: number, y: number, str: string, color?: string, wrap?: number) => {
      const o = addText(this, x, y, str, { color, wrap }).setDepth(31);
      objs.push(o);
      return o;
    };
    objs.push(addText(this, GAME_W / 2, 14, 'Chapter One: The Welcome', { font: TITLE_FONT_CSS, size: 27, color: UI.textGold }).setOrigin(0.5, 0).setDepth(31));
    t(22, 54, 'Objective', UI.textDim);
    t(22, 72, s.objective, UI.text, GAME_W - 48);
    t(22, 122, 'Devotion', UI.textRose);
    t(22, 146, 'Clarity', '#9fe0f6');
    const pips = (y: number, n: number, full: string, empty: string) => {
      for (let i = 0; i < 8; i++) objs.push(this.add.image(130 + i * 18, y, i < n ? full : empty).setScale(i < n ? 2 : 2).setDepth(31));
    };
    pips(131, Math.min(8, s.devotion), 'icon:heart', 'icon:heartEmpty');
    pips(155, Math.min(8, s.clarity), 'icon:spark', 'icon:sparkEmpty');
    t(290, 122, s.devotion > s.clarity ? 'He is getting under your skin.' : s.clarity > s.devotion ? 'You are watching him closely.' : 'Your heart is undecided.', '#c9b8e6', 170);
    const mins = Math.floor(s.playSeconds / 60);
    t(22, 186, `Familiars seen: ${s.seen.length}/${SPECIES_IDS.length}    Bound: ${s.caught.length}`);
    t(22, 206, `Marks: ${s.marks}    Duels won: ${s.defeated.length}`);
    t(22, 226, `Time: ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`);
    t(22, 270, 'Press any button to close.', UI.textDim);
    await this.waitAny();
    sound.sfx('cancel');
    for (const o of objs) o.destroy();
  }

  private async save(): Promise<void> {
    const ok = saveGame(session.state);
    if (ok) sound.sfx('save');
    this.footer(ok ? 'Your story was saved.' : 'Saving failed. Your browser may be blocking storage.');
    await this.waitAny();
  }

  private async soundMenu(): Promise<void> {
    for (;;) {
      const menu = new ListMenu(this, {
        x: GAME_W - 202,
        y: 6,
        w: 196,
        items: [{ label: `Music: ${sound.musicOn ? 'On' : 'Off'}` }, { label: `Effects: ${sound.sfxOn ? 'On' : 'Off'}` }, { label: 'Back' }],
        depth: 30,
      });
      const i = await menu.pick(true);
      menu.destroy();
      if (i === 0) sound.setMusic(!sound.musicOn);
      else if (i === 1) sound.setSfx(!sound.sfxOn);
      else return;
    }
  }
}
