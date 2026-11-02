// Older phones and Windows 10 lack the newer emoji and draw an empty box instead.

const SIZE = 24;
const known = new Map<string, boolean>();
let pen: CanvasRenderingContext2D | null | undefined;

function canvas(): CanvasRenderingContext2D | null {
  if (pen !== undefined) return pen;
  pen = null;
  if (typeof document === 'undefined' || /jsdom/i.test(navigator.userAgent)) return pen;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    pen = c.getContext('2d', { willReadFrequently: true });
    if (pen) {
      pen.font = `${SIZE - 4}px sans-serif`;
      pen.textBaseline = 'top';
      pen.fillStyle = '#000';
    }
  } catch {
    pen = null;
  }
  return pen;
}

/** Whether the device draws `e` as a color emoji. A missing one comes out as a black box, or not at all. Assumes yes when it can't tell. */
export function canDraw(e: string): boolean {
  const cached = known.get(e);
  if (cached !== undefined) return cached;
  const ctx = canvas();
  let ok = true;
  if (ctx) {
    try {
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.fillText(e, 0, 0);
      const px = ctx.getImageData(0, 0, SIZE, SIZE).data;
      ok = false;
      for (let i = 0; i < px.length && !ok; i += 4) ok = px[i + 3] > 0 && (px[i] > 16 || px[i + 1] > 16 || px[i + 2] > 16);
    } catch {
      ok = true;
    }
  }
  known.set(e, ok);
  return ok;
}

/** `e` where the device has it, else an older emoji that every device has. */
export const emoji = (e: string, fallback: string): string => (canDraw(e) ? e : fallback);
