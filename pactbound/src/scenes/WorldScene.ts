import Phaser from 'phaser';
import { sound, type Sfx } from '../audio/sound';
import type { Outcome } from '../battle/engine';
import { GAME_H, GAME_W, RUN_TIME, TILE, UI, WALK_TIME, WORLD_ZOOM } from '../config';
import { createFamiliar, displayName } from '../core/familiar';
import { createRng } from '../core/rng';
import { saveGame } from '../core/save';
import { session } from '../core/session';
import { addFamiliar, addItem, getFlag, hasFlag, healParty, setFlag, firstHealthy, type Dir, type FlagValue } from '../core/state';
import type { LookId, Speaker, SpeakerId } from '../data/cast';
import { ITEMS, type ItemId } from '../data/items';
import { SPECIES, type SpeciesId } from '../data/species';
import { ensureMapTextures, famKey, mapKey } from '../gfx/textures';
import { controls } from '../input/controls';
import type { ActorHandle, BattleRequest, Script, ScriptApi } from '../story/api';
import { F, timeOfDay, type TimeOfDay } from '../story/flags';
import { SCRIPTS } from '../story/scripts';
import { trainerEncounter } from '../story/common';
import type { LineStyle } from '../ui/DialogueBox';
import { addText, drawPanel, nextFrame, tweenAsync, waitSeconds } from '../ui/kit';
import { ListMenu } from '../ui/ListMenu';
import { Actor, DIR_VEC, opposite } from '../world/Actor';
import { getMap } from '../world/maps';
import { tileInfo } from '../world/tiles';
import type { MapDef, MapId, NpcDef, PickupDef, ThingDef, TrackId } from '../world/types';
import type { BattleSceneData } from './BattleScene';
import type { UIScene } from './UIScene';

interface ThingObj {
  def: ThingDef;
  visible: boolean;
  sprite: Phaser.GameObjects.Image | null;
}

interface Move {
  fromX: number;
  fromY: number;
  dir: Dir;
  t: number;
  dur: number;
}

const VIEW_W = GAME_W / WORLD_ZOOM;
const VIEW_H = GAME_H / WORLD_ZOOM;

export class WorldScene extends Phaser.Scene {
  map!: MapDef;
  ui!: UIScene;
  player!: Actor;
  private mapImg!: Phaser.GameObjects.Image;
  private animFrame: 0 | 1 = 0;
  private animTimer = 0;
  private actors = new Map<string, Actor>();
  private things: ThingObj[] = [];
  private pickups = new Map<string, Phaser.GameObjects.Image>();
  private motes: { img: Phaser.GameObjects.Image; phase: number; speed: number }[] = [];
  private move: Move | null = null;
  private turnDelay = 0;
  busy = false;
  private stepsSinceBattle = 0;
  private rng = createRng();
  private camOverride: { x: number; y: number } | null = null;
  private trackOverride: TrackId | null = null;
  api!: ScriptApi;

  constructor() {
    super('World');
  }

  get state() {
    return session.state;
  }

  create(): void {
    this.ui = this.scene.get('UI') as UIScene;
    this.cameras.main.setZoom(WORLD_ZOOM).setBackgroundColor('#0c0810');
    this.cameras.main.setRoundPixels(true);
    this.api = this.makeApi();
    this.actors.clear();
    this.things = [];
    this.pickups.clear();
    this.motes = [];
    this.move = null;
    this.busy = false;
    const s = this.state;
    this.loadMap(getMap(s.map).id, s.x, s.y, s.facing);
    this.ui.setFade(1);
    void this.enterMap(true);
  }

  // ── Map lifecycle ───────────────────────────────────────────────────────

  private loadMap(id: MapId, x: number, y: number, dir: Dir): void {
    this.tweens.killAll();
    for (const a of this.actors.values()) a.destroy();
    this.actors.clear();
    for (const t of this.things) t.sprite?.destroy();
    this.things = [];
    for (const p of this.pickups.values()) p.destroy();
    this.pickups.clear();
    for (const m of this.motes) m.img.destroy();
    this.motes = [];
    this.player?.destroy();
    this.mapImg?.destroy();

    this.map = getMap(id);
    ensureMapTextures(this, id);
    this.mapImg = this.add.image(0, 0, mapKey(id, this.animFrame)).setOrigin(0).setDepth(-10);
    this.player = new Actor(this, 'player', 'wren', x, y, dir);
    this.things = this.map.things.map((def) => ({ def, visible: false, sprite: null }));
    this.refresh();
    for (const p of this.map.pickups) if (!hasFlag(this.state, `pickup:${p.id}`)) this.addPickupSprite(p);
    this.makeMotes();
    this.camOverride = null;
    this.trackOverride = null;
    this.syncState();
    this.updateCamera();
  }

  /** Fade in, show the area name, run the map's entry script. */
  private async enterMap(first: boolean): Promise<void> {
    this.applyTime(0);
    this.playMapMusic();
    const wasBusy = this.busy;
    this.busy = true;
    await this.ui.fade(0, first ? 600 : 300);
    this.ui.showBanner(this.map.name);
    this.busy = wasBusy;
    const script = this.map.onEnter ? SCRIPTS[this.map.onEnter] : undefined;
    if (!script) return;
    // Inside a running script (a scripted warp or a blackout) the entry script runs inline.
    if (wasBusy) await script(this.api);
    else await this.runWith(script);
  }

  private playMapMusic(): void {
    let track: TrackId = this.trackOverride ?? this.map.music;
    if (!this.trackOverride && timeOfDay(this.state) === 'night' && this.map.outdoor && this.map.id === 'courtyard') track = 'lucien';
    sound.music(track);
  }

  async warp(id: MapId, x: number, y: number, dir: Dir): Promise<void> {
    const wasBusy = this.busy;
    this.busy = true;
    sound.sfx('door');
    await this.ui.fade(1, 260);
    this.loadMap(id, x, y, dir);
    this.busy = wasBusy;
    await this.enterMap(false);
  }

  /** Shows or hides NPCs and objects whose `when` conditions changed. */
  refresh(): void {
    const s = this.state;
    for (const def of this.map.npcs) {
      const visible = !def.when || def.when(s);
      const existing = this.actors.get(def.id);
      if (visible && !existing) this.actors.set(def.id, new Actor(this, def.id, def.look, def.x, def.y, def.dir));
      else if (!visible && existing && !existing.scripted) {
        existing.destroy();
        this.actors.delete(def.id);
      }
    }
    for (const t of this.things) {
      const visible = !t.def.when || t.def.when(s);
      t.visible = visible;
      if (visible && t.def.sprite && !t.sprite) t.sprite = this.makeThingSprite(t.def);
      if (!visible && t.sprite) {
        t.sprite.destroy();
        t.sprite = null;
      }
    }
  }

  private makeThingSprite(def: ThingDef): Phaser.GameObjects.Image {
    const x = Actor.px(def.x);
    if (def.sprite === 'sign') return this.add.image(x, def.y * TILE, 'icon:sign').setOrigin(0.5, 0).setDepth(def.y * TILE + 14);
    if (def.sprite === 'sparkle') return this.add.image(x, def.y * TILE + 8, 'icon:sparkle0').setDepth(def.y * TILE + 8);
    const species = (def.sprite as string).slice('familiar:'.length) as SpeciesId;
    const onPedestal = this.map.rows[def.y]?.[def.x] === 'P';
    const img = this.add
      .image(x, def.y * TILE + (onPedestal ? 9 : 15), famKey(species))
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setDepth(def.y * TILE + 15);
    if (onPedestal) {
      this.tweens.add({ targets: img, y: img.y - 1, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      this.tweens.add({ targets: img, x: x + 1.5, duration: 90, yoyo: true, repeat: -1 });
    }
    return img;
  }

  private addPickupSprite(p: PickupDef): void {
    const img = this.add.image(Actor.px(p.x), p.y * TILE + 8, 'icon:sparkle0').setDepth(p.y * TILE + 8);
    this.pickups.set(p.id, img);
  }

  private makeMotes(): void {
    const night = timeOfDay(this.state) === 'night';
    const forest = this.map.id === 'gloamwood';
    if (!this.map.outdoor || (!night && !forest)) return;
    const w = this.map.rows[0]!.length * TILE;
    const h = this.map.rows.length * TILE;
    const n = forest ? 26 : 14;
    for (let i = 0; i < n; i++) {
      const img = this.add
        .image(this.rng.next() * w, this.rng.next() * h, 'pixel')
        .setTint(forest && !night ? 0xd8d0ff : 0xfff0a0)
        .setAlpha(0.7)
        .setDepth(5000);
      this.motes.push({ img, phase: this.rng.next() * Math.PI * 2, speed: 4 + this.rng.next() * 6 });
    }
  }

  applyTime(ms = 600): void {
    const t = timeOfDay(this.state);
    const outdoor = this.map.outdoor;
    if (t === 'night') this.ui.setAmbient(0x0a0e30, outdoor ? 0.42 : 0.2, ms);
    else if (t === 'dusk') this.ui.setAmbient(0x6a2a5a, outdoor ? 0.18 : 0.06, ms);
    else this.ui.setAmbient(0x000000, 0, ms);
  }

  private syncState(): void {
    const s = this.state;
    s.map = this.map.id;
    s.x = this.player.tx;
    s.y = this.player.ty;
    s.facing = this.player.facing;
  }

  // ── Per-frame ───────────────────────────────────────────────────────────

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.state.playSeconds += dt;

    this.animTimer += dt;
    if (this.animTimer > 0.45) {
      this.animTimer = 0;
      this.animFrame = this.animFrame === 0 ? 1 : 0;
      this.mapImg.setTexture(mapKey(this.map.id, this.animFrame));
      for (const p of this.pickups.values()) p.setTexture(`icon:sparkle${this.animFrame}`);
      for (const t of this.things) if (t.def.sprite === 'sparkle' && t.sprite) t.sprite.setTexture(`icon:sparkle${this.animFrame}`);
    }
    for (const m of this.motes) {
      m.phase += dt;
      m.img.x += Math.sin(m.phase * 0.7) * dt * m.speed;
      m.img.y -= dt * m.speed * 0.4;
      m.img.setAlpha(0.35 + 0.35 * Math.sin(m.phase * 2.1));
      if (m.img.y < -4) m.img.y = this.map.rows.length * TILE + 4;
    }

    if (this.move) this.advanceMove(dt);
    else if (!this.busy) this.handleInput(dt);
    this.updateCamera();
  }

  private handleInput(dt: number): void {
    if (controls.consume('menu')) {
      this.openMenu();
      return;
    }
    if (controls.consume('a')) {
      void this.interact();
      return;
    }
    const dir = controls.heldDir();
    if (!dir) {
      this.turnDelay = 0;
      return;
    }
    if (dir !== this.player.facing) {
      // A quick tap turns on the spot; holding the direction then walks.
      this.player.face(dir);
      this.turnDelay = 0.07;
      return;
    }
    if (this.turnDelay > 0) {
      this.turnDelay -= dt;
      return;
    }
    this.tryMove(dir, 0);
  }

  private tryMove(dir: Dir, carry: number): boolean {
    this.player.face(dir);
    const [dx, dy] = DIR_VEC[dir];
    const nx = this.player.tx + dx;
    const ny = this.player.ty + dy;
    if (this.blocked(nx, ny)) {
      if (carry === 0) sound.sfx('bump');
      this.player.showFrame(0);
      return false;
    }
    const fromX = Actor.px(this.player.tx);
    const fromY = Actor.py(this.player.ty);
    this.player.tx = nx;
    this.player.ty = ny;
    const dur = controls.isDown('b') ? RUN_TIME : WALK_TIME;
    this.move = { fromX, fromY, dir, t: carry, dur };
    this.player.showFrame(this.player.nextPhase());
    return true;
  }

  private advanceMove(dt: number): void {
    const m = this.move as Move;
    m.t += dt;
    const k = Math.min(1, m.t / m.dur);
    const [dx, dy] = DIR_VEC[m.dir];
    this.player.setPixel(m.fromX + dx * TILE * k, m.fromY + dy * TILE * k);
    if (k >= 0.5) this.player.showFrame(0);
    if (k < 1) return;
    const carry = m.t - m.dur;
    this.move = null;
    this.player.place(this.player.tx, this.player.ty);
    this.syncState();
    if (this.arrive()) return;
    const held = controls.heldDir();
    if (held && !this.busy) {
      if (!this.tryMove(held, carry)) this.player.showFrame(0);
    } else this.player.showFrame(0);
  }

  /** Doors, triggers and wild encounters. Returns true if something took over. */
  private arrive(): boolean {
    const { tx, ty } = this.player;
    const warp = this.map.warps.find((w) => w.x === tx && w.y === ty);
    if (warp) {
      void this.warp(warp.to, warp.tx, warp.ty, warp.dir);
      return true;
    }
    const trig = this.map.triggers.find((t) => t.x === tx && t.y === ty && (!t.when || t.when(this.state)));
    if (trig) {
      void this.run(trig.script);
      return true;
    }
    this.stepsSinceBattle += 1;
    const ch = this.map.rows[ty]?.[tx] ?? ' ';
    if (tileInfo(ch).encounter && this.stepsSinceBattle > 2 && firstHealthy(this.state) >= 0) {
      const zone = this.map.encounters.find(
        (z) => !z.area || (tx >= z.area[0] && ty >= z.area[1] && tx < z.area[0] + z.area[2] && ty < z.area[1] + z.area[3]),
      );
      if (zone && this.rng.chance(zone.rate)) {
        const total = zone.table.reduce((n, e) => n + e.weight, 0);
        let roll = this.rng.next() * total;
        const pick = zone.table.find((e) => (roll -= e.weight) < 0) ?? zone.table[0];
        if (pick) {
          void this.wildBattle(pick.species, this.rng.int(pick.min, pick.max));
          return true;
        }
      }
    }
    return false;
  }

  blocked(x: number, y: number): boolean {
    if (y < 0 || y >= this.map.rows.length || x < 0 || x >= (this.map.rows[0]?.length ?? 0)) return true;
    if (tileInfo(this.map.rows[y]![x] ?? ' ').solid) return true;
    for (const a of this.actors.values()) if (a.tx === x && a.ty === y && a.sprite.visible) return true;
    if (this.things.some((t) => t.visible && t.sprite && t.def.x === x && t.def.y === y)) return true;
    for (const p of this.map.pickups) if (p.x === x && p.y === y && this.pickups.has(p.id)) return true;
    return false;
  }

  private updateCamera(): void {
    const cam = this.cameras.main;
    const mapW = (this.map.rows[0]?.length ?? 0) * TILE;
    const mapH = this.map.rows.length * TILE;
    let cx = this.camOverride ? this.camOverride.x : this.player.sprite.x;
    // Frame the player a little above centre so the dialogue box never hides her.
    let cy = this.camOverride ? this.camOverride.y : this.player.sprite.y + 10;
    cx = mapW <= VIEW_W ? mapW / 2 : Phaser.Math.Clamp(cx, VIEW_W / 2, mapW - VIEW_W / 2);
    cy = mapH <= VIEW_H ? mapH / 2 : Phaser.Math.Clamp(cy, VIEW_H / 2, mapH - VIEW_H / 2);
    cam.centerOn(Math.round(cx * WORLD_ZOOM) / WORLD_ZOOM, Math.round(cy * WORLD_ZOOM) / WORLD_ZOOM);
  }

  // ── Interaction ─────────────────────────────────────────────────────────

  private async interact(): Promise<void> {
    const [dx, dy] = DIR_VEC[this.player.facing];
    let x = this.player.tx + dx;
    let y = this.player.ty + dy;
    if (tileInfo(this.map.rows[y]?.[x] ?? ' ').counter) {
      x += dx;
      y += dy;
    }
    for (const [id, a] of this.actors) {
      if (a.tx !== x || a.ty !== y || !a.sprite.visible) continue;
      const def = this.map.npcs.find((n) => n.id === id);
      if (!def) return;
      a.face(opposite(this.player.facing));
      await this.talk(def);
      return;
    }
    const thing = this.things.find((t) => t.visible && t.def.x === x && t.def.y === y)
      ?? this.things.find((t) => t.visible && t.def.x === this.player.tx + dx && t.def.y === this.player.ty + dy);
    if (thing) {
      await this.run(thing.def.talk);
      return;
    }
    const pickup = this.map.pickups.find((p) => p.x === this.player.tx + dx && p.y === this.player.ty + dy && this.pickups.has(p.id));
    if (pickup) await this.collect(pickup);
  }

  private async talk(def: NpcDef): Promise<void> {
    if (def.trainer) {
      const id = def.trainer;
      await this.runWith((s) => trainerEncounter(s, id, def.id));
    } else if (def.talk) await this.run(def.talk);
  }

  private async collect(p: PickupDef): Promise<void> {
    await this.runWith(async (s) => {
      setFlag(this.state, `pickup:${p.id}`);
      this.pickups.get(p.id)?.destroy();
      this.pickups.delete(p.id);
      await s.give(p.item, p.qty);
    });
  }

  /** Runs a script by id. Input is blocked while it runs. */
  async run(id: string): Promise<void> {
    const script = SCRIPTS[id];
    if (!script) {
      console.warn(`No script "${id}"`);
      return;
    }
    await this.runWith(script);
  }

  async runWith(script: Script): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.player.showFrame(0);
    try {
      await script(this.api);
    } catch (err) {
      console.error(err);
    } finally {
      this.ui.closeDialogue();
      this.busy = false;
      if (this.scene.isActive()) this.refresh();
      controls.flush();
    }
  }

  private openMenu(): void {
    sound.sfx('confirm');
    this.busy = true;
    this.scene.pause();
    this.scene.launch('Menu', {
      onClose: () => {
        this.scene.resume();
        this.busy = false;
        controls.flush();
      },
    });
  }

  // ── Battles ─────────────────────────────────────────────────────────────

  private async wildBattle(species: SpeciesId, level: number): Promise<void> {
    await this.runWith(async (s) => {
      const outcome = await s.battle({ kind: 'wild', foe: [createFamiliar(species, level)] });
      if (outcome === 'lose') await this.blackout();
    });
  }

  async startBattle(req: BattleRequest): Promise<Outcome> {
    this.ui.closeDialogue();
    sound.sfx('encounter');
    sound.music(req.music ?? 'battle');
    const cam = this.cameras.main;
    cam.flash(160, 255, 255, 255);
    await waitSeconds(this, 0.2);
    cam.flash(160, 255, 255, 255);
    await this.ui.fade(1, 320);
    const outcome = await new Promise<Outcome>((resolve) => {
      const data: BattleSceneData = {
        ...req,
        bg: req.bg ?? this.map.battleBg,
        onDone: (o) => {
          this.scene.stop('Battle');
          this.scene.wake('UI');
          this.scene.wake();
          resolve(o);
        },
      };
      this.scene.sleep('UI');
      this.scene.sleep();
      this.scene.launch('Battle', data);
    });
    this.stepsSinceBattle = 0;
    controls.flush();
    this.playMapMusic();
    await this.ui.fade(0, 300);
    return outcome;
  }

  /** Every familiar fainted in an ordinary fight: Wren wakes up in the dormitory. */
  async blackout(): Promise<void> {
    await this.ui.narrate(["Wren's vision blurred...", "She woke in the dormitory. Someone had tucked her in and left a cup of moonmilk by the bed."], {
      keepDark: true,
    });
    healParty(this.state);
    this.loadMap('dormitory', 4, 3, 'left');
    await this.enterMap(false);
  }

  // ── Script API ──────────────────────────────────────────────────────────

  private handle(a: Actor): ActorHandle {
    return {
      get id() {
        return a.id;
      },
      get x() {
        return a.tx;
      },
      get y() {
        return a.ty;
      },
      get facing() {
        return a.facing;
      },
      face: (d) => a.face(d),
      place: (x, y, dir) => {
        a.place(x, y);
        if (dir) a.face(dir);
        if (a === this.player) this.syncState();
      },
      walkPath: async (dirs, seconds) => {
        await a.walkPath(dirs, seconds);
        if (a === this.player) this.syncState();
      },
      emote: (k) => a.emote(k),
    };
  }

  private makeApi(): ScriptApi {
    const world = this;
    const speaker = (who: SpeakerId | Speaker | null): SpeakerId | Speaker | null => who;
    return {
      get state() {
        return session.state;
      },
      say: async (who, text, style?: LineStyle) => {
        const sp = speaker(who);
        if (sp && typeof sp === 'object') await world.ui.dialogue.say(sp, text, style);
        else await world.ui.say(sp, text, style);
      },
      think: (text) => world.ui.say('wren', text, { thought: true }),
      whisper: (who, text) => world.ui.say(who, text, { whisper: true }),
      choose: (options, cancelIndex) => world.ui.choose(options, cancelIndex),
      narrate: (paragraphs, opts) => world.ui.narrate(paragraphs, opts),
      wait: (seconds) => waitSeconds(world, seconds),
      fadeOut: (ms) => world.ui.fade(1, ms),
      fadeIn: (ms) => world.ui.fade(0, ms),
      closeDialogue: () => world.ui.closeDialogue(),
      flag: (key) => getFlag(session.state, key),
      has: (key) => hasFlag(session.state, key),
      set: (key, value: FlagValue = true) => setFlag(session.state, key, value),
      devotion: (n) => {
        session.state.devotion += n;
        world.ui.bondPing('devotion', n);
      },
      clarity: (n) => {
        session.state.clarity += n;
        world.ui.bondPing('clarity', n);
      },
      objective: (text) => {
        session.state.objective = text;
        world.ui.showBanner(`Journal: ${text.length > 40 ? 'objective updated' : text}`);
      },
      give: async (item: ItemId, qty = 1) => {
        addItem(session.state, item, qty);
        sound.sfx('item');
        const def = ITEMS[item];
        await world.ui.say(null, qty > 1 ? `Wren received ${qty} x ${def.name}!` : `Wren received the ${def.name}!`);
      },
      bind: async (species, level) => {
        const f = createFamiliar(species, level);
        const where = addFamiliar(session.state, f);
        sound.sfx('caught');
        await world.ui.say(null, `Wren formed a pact with ${SPECIES[species].name}!`);
        if (where === 'storage') await world.ui.say(null, `Wren's party is full, so ${displayName(f)} went to wait in the Conservatory.`);
        return f;
      },
      heal: async () => {
        healParty(session.state);
        sound.sfx('heal');
        await waitSeconds(world, 0.4);
      },
      battle: (req) => world.startBattle(req),
      blackout: () => world.blackout(),
      curtain: (on, ms) => world.ui.curtain(on, ms),
      shop: () => world.shop(),
      get player() {
        return world.handle(world.player);
      },
      actor: (id) => {
        const a = world.actors.get(id);
        return a ? world.handle(a) : null;
      },
      spawn: (id, look: LookId, x, y, dir) => {
        world.actors.get(id)?.destroy();
        const a = new Actor(world, id, look, x, y, dir);
        a.scripted = true;
        world.actors.set(id, a);
        return world.handle(a);
      },
      despawn: (id) => {
        world.actors.get(id)?.destroy();
        world.actors.delete(id);
      },
      refresh: () => world.refresh(),
      panTo: async (x, y, ms = 600) => {
        const from = world.camOverride ?? { x: world.player.sprite.x, y: world.player.sprite.y - 8 };
        world.camOverride = { ...from };
        await tweenAsync(world, { targets: world.camOverride, x: Actor.px(x), y: Actor.py(y) - 8, duration: ms, ease: 'Sine.easeInOut' });
      },
      panBack: async (ms = 500) => {
        if (!world.camOverride) return;
        await tweenAsync(world, { targets: world.camOverride, x: world.player.sprite.x, y: world.player.sprite.y - 8, duration: ms, ease: 'Sine.easeInOut' });
        world.camOverride = null;
      },
      shake: (ms = 250, intensity = 0.006) => world.cameras.main.shake(ms, intensity),
      music: (track) => {
        world.trackOverride = track;
        if (track) sound.music(track);
        else world.playMapMusic();
      },
      sfx: (name: Sfx) => sound.sfx(name),
      vignette: (on) => world.ui.setVignette(on),
      setTime: (t: TimeOfDay) => {
        setFlag(session.state, F.time, t);
        world.applyTime(800);
      },
      warp: (map, x, y, dir) => world.warp(map, x, y, dir),
      save: () => {
        const ok = saveGame(session.state);
        if (ok) sound.sfx('save');
        return ok;
      },
      chapterEnd: async () => {
        await new Promise<void>((resolve) => {
          world.scene.pause();
          world.scene.sleep('UI');
          world.scene.launch('Ending', {
            onDone: () => {
              world.scene.stop('Ending');
              world.scene.wake('UI');
              world.scene.resume();
              resolve();
            },
          });
        });
        controls.flush();
      },
    };
  }

  /** Mr. Tallow's cart. */
  private async shop(): Promise<void> {
    const stock: ItemId[] = ['tonic', 'remedy', 'sigil', 'draught'];
    const header = this.ui.add.graphics().setDepth(940);
    const marks = addText(this.ui, 16, 13, '', { color: UI.textGold }).setDepth(941);
    const showMarks = () => {
      marks.setText(`Marks: ${this.state.marks}`);
      header.clear();
      drawPanel(header, 6, 6, Math.ceil(marks.width) + 22, 28);
    };
    showMarks();
    const menu = new ListMenu(this.ui, {
      x: GAME_W - 236,
      y: 40,
      w: 228,
      items: [...stock.map((id) => ({ label: ITEMS[id].name, right: `${ITEMS[id].price}` })), { label: 'Done' }],
      depth: 940,
    });
    const desc = addText(this.ui, 18, 252, '', { wrap: 440 }).setDepth(941);
    const descG = this.ui.add.graphics().setDepth(939);
    drawPanel(descG, 6, 236, GAME_W - 12, 78);
    const describe = (i: number) => desc.setText(i < stock.length ? ITEMS[stock[i] as ItemId].desc : 'Leave the cart.');
    describe(0);
    menu.onMove = describe;
    for (;;) {
      const i = await menu.pick();
      if (i < 0 || i >= stock.length) break;
      const id = stock[i] as ItemId;
      const price = ITEMS[id].price ?? 0;
      if (this.state.marks < price) {
        sound.sfx('bump');
        desc.setText("Mr. Tallow: Can't spot you that one, love. Come back with more marks.");
        continue;
      }
      this.state.marks -= price;
      addItem(this.state, id);
      sound.sfx('item');
      showMarks();
      desc.setText(`Bought a ${ITEMS[id].name}. You have ${this.state.bag[id] ?? 0}.`);
    }
    menu.destroy();
    desc.destroy();
    descG.destroy();
    header.destroy();
    marks.destroy();
    await nextFrame(this);
  }
}

