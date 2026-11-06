import { controls, type Button } from './controls';

/**
 * On-screen controls for phones and tablets: a D-pad, A/B and Menu. Shown
 * automatically on touch devices (or with ?touch=1), hidden on desktop.
 * In portrait the pad sits under the screen like a handheld console.
 */
export function installTouchControls(onLayoutChange: () => void): void {
  const forced = new URLSearchParams(location.search).get('touch');
  const isTouch = forced === '1' || (forced !== '0' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window));
  if (!isTouch) return;
  document.body.classList.add('touch');

  const pad = document.createElement('div');
  pad.id = 'pad';
  pad.innerHTML = `
    <div class="dpad" aria-label="Direction pad">
      <div class="up">&#9650;</div><div class="left">&#9664;</div><div class="hub"></div>
      <div class="right">&#9654;</div><div class="down">&#9660;</div>
    </div>
    <button class="menu" data-btn="menu" aria-label="Menu">MENU</button>
    <div class="ab">
      <button class="b" data-btn="b" aria-label="B">B</button>
      <button class="a" data-btn="a" aria-label="A">A</button>
    </div>`;
  document.getElementById('shell')?.append(pad);

  // A and B and Menu: plain buttons, multi-touch safe.
  for (const el of pad.querySelectorAll<HTMLButtonElement>('button[data-btn]')) {
    const b = el.dataset.btn as Button;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('down');
      controls.press(b);
    };
    const up = (e: PointerEvent) => {
      e.preventDefault();
      el.classList.remove('down');
      controls.release(b);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // D-pad: direction from the touch angle, so the thumb can slide between directions.
  const dpad = pad.querySelector<HTMLElement>('.dpad') as HTMLElement;
  let active: Button | null = null;
  let pointer: number | null = null;
  const setDir = (b: Button | null) => {
    if (b === active) return;
    if (active) {
      controls.release(active);
      dpad.querySelector(`.${active}`)?.classList.remove('down');
    }
    active = b;
    if (b) {
      controls.press(b);
      dpad.querySelector(`.${b}`)?.classList.add('down');
    }
  };
  const fromEvent = (e: PointerEvent): Button | null => {
    const r = dpad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < 14) return active;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  };
  dpad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointer = e.pointerId;
    dpad.setPointerCapture?.(e.pointerId);
    setDir(fromEvent(e));
  });
  dpad.addEventListener('pointermove', (e) => {
    if (e.pointerId === pointer) setDir(fromEvent(e));
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    setDir(null);
  };
  dpad.addEventListener('pointerup', end);
  dpad.addEventListener('pointercancel', end);

  onLayoutChange();
  addEventListener('resize', onLayoutChange);
  addEventListener('orientationchange', onLayoutChange);
}
