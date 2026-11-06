import { rgb } from './color';

/**
 * A tiny RGBA pixel buffer. All procedural art is drawn here pixel by pixel
 * (no canvas anti-aliasing), then copied into a canvas for Phaser.
 */
export class PixBuf {
  readonly data: Uint8ClampedArray<ArrayBuffer>;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, c: number, a = 255): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const i = (y * this.w + x) * 4;
    const [r, g, b] = rgb(c);
    if (a >= 255 || this.data[i + 3] === 0) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = a;
      return;
    }
    // Alpha-blend over what is already there.
    const t = a / 255;
    this.data[i] = this.data[i]! + (r - this.data[i]!) * t;
    this.data[i + 1] = this.data[i + 1]! + (g - this.data[i + 1]!) * t;
    this.data[i + 2] = this.data[i + 2]! + (b - this.data[i + 2]!) * t;
    this.data[i + 3] = Math.max(this.data[i + 3]!, a);
  }

  /** Colour at (x, y), or -1 when transparent / out of bounds. */
  get(x: number, y: number): number {
    if (!this.inside(x, y)) return -1;
    const i = (y * this.w + x) * 4;
    if (this.data[i + 3] === 0) return -1;
    return (this.data[i]! << 16) | (this.data[i + 1]! << 8) | this.data[i + 2]!;
  }

  rect(x: number, y: number, w: number, h: number, c: number, a = 255): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c, a);
  }

  /** Copies another buffer in, skipping transparent pixels. */
  blit(src: PixBuf, dx: number, dy: number, flipX = false): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        const a = src.data[i + 3]!;
        if (a === 0) continue;
        const c = (src.data[i]! << 16) | (src.data[i + 1]! << 8) | src.data[i + 2]!;
        this.set(dx + (flipX ? src.w - 1 - x : x), dy + y, c, a);
      }
    }
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.putImageData(new ImageData(this.data, this.w, this.h), 0, 0);
    return canvas;
  }
}

/** Paints a grid of palette keys; '.' and ' ' are transparent, unknown keys are skipped. */
export function paintRows(
  buf: PixBuf,
  rows: readonly string[],
  palette: Readonly<Record<string, number>>,
  ox = 0,
  oy = 0,
  flipX = false,
  width = 16,
): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] as string;
      if (ch === '.' || ch === ' ') continue;
      const c = palette[ch];
      if (c === undefined) continue;
      buf.set(ox + (flipX ? width - 1 - x : x), oy + y, c);
    }
  });
}
