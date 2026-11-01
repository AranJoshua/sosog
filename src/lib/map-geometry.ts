import { BOUNDS, MAP_HEIGHT } from '../components/map/boundaries';

/** Width of the SVG coordinate space the boundary paths were generated in. Its height is MAP_HEIGHT (see boundaries.ts). */
export const MAP_SIZE = 800;
export { MAP_HEIGHT };

export interface Point {
  x: number;
  y: number;
}

/** An SVG viewBox: top-left corner plus width and height. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const PROVINCE_BOX: Box = { x: 0, y: 0, w: MAP_SIZE, h: MAP_HEIGHT };

/**
 * Projects latitude/longitude onto the boundary paths' space (800 wide,
 * MAP_HEIGHT tall). Same linear projection boundaries.ts documents, so pins
 * and borders line up. Coordinates outside the province box (an offshore
 * island, say) project to values below 0 or beyond the width and height
 * instead of being clamped.
 */
export function project(latitude: number, longitude: number): Point {
  const x = ((longitude - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * MAP_SIZE;
  const y = ((BOUNDS.maxLat - latitude) / (BOUNDS.maxLat - BOUNDS.minLat)) * MAP_HEIGHT;
  return { x, y };
}

/** Bounding box of every "x y" pair in an absolute M/L/Z path string. */
export function pathBox(d: string): Box {
  const numbers = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length < 2) return { ...PROVINCE_BOX };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    minX = Math.min(minX, numbers[i]);
    maxX = Math.max(maxX, numbers[i]);
    minY = Math.min(minY, numbers[i + 1]);
    maxY = Math.max(maxY, numbers[i + 1]);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Smallest box containing every given box. */
export function unionBoxes(boxes: Box[]): Box {
  if (boxes.length === 0) return { ...PROVINCE_BOX };
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** A zero-size box at each point, so points can be unioned with real boxes. */
export function pointBoxes(points: Point[]): Box[] {
  return points.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 }));
}

/** Grows a box by `pad` on every side and guarantees a minimum width and height, keeping it centred. */
export function padBox(box: Box, pad: number, minSize = 0): Box {
  let { x, y, w, h } = box;
  x -= pad;
  y -= pad;
  w += pad * 2;
  h += pad * 2;
  if (w < minSize) {
    x -= (minSize - w) / 2;
    w = minSize;
  }
  if (h < minSize) {
    y -= (minSize - h) / 2;
    h = minSize;
  }
  return { x, y, w, h };
}

/** Linear blend between two boxes, used to animate zooming. */
export function lerpBox(a: Box, b: Box, t: number): Box {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t
  };
}

export function boxToViewBox(box: Box): string {
  return `${round(box.x)} ${round(box.y)} ${round(box.w)} ${round(box.h)}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function easeInOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 2 * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
}

/**
 * Pushes pins that sit closer than `minDistance` apart until they no longer
 * overlap, so structures with identical or near-identical coordinates stay
 * individually clickable. Deterministic: the same input always produces the
 * same output, and pins that are already far enough apart do not move.
 * A pin never moves further than `maxShift` from its true position.
 */
export function declutter<T extends Point & { id: string }>(
  points: T[],
  minDistance: number,
  maxShift = minDistance * 3,
  iterations = 40
): Map<string, Point> {
  const origin = new Map<string, Point>();
  const current = points.map((p, i) => {
    origin.set(p.id, { x: p.x, y: p.y });
    return { id: p.id, x: p.x, y: p.y, index: i };
  });

  for (let pass = 0; pass < iterations; pass++) {
    let moved = false;
    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const a = current[i];
        const b = current[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        if (distance < 1e-9) {
          // Identical positions: spread along a fixed angle per pair so the result is repeatable.
          const angle = ((i * 7 + j * 13) % 12) * (Math.PI / 6);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = (minDistance - Math.hypot(b.x - a.x, b.y - a.y) || minDistance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    }
    for (const c of current) {
      const home = origin.get(c.id)!;
      const offset = Math.hypot(c.x - home.x, c.y - home.y);
      if (offset > maxShift) {
        c.x = home.x + ((c.x - home.x) / offset) * maxShift;
        c.y = home.y + ((c.y - home.y) / offset) * maxShift;
      }
    }
    if (!moved) break;
  }

  return new Map(current.map((c) => [c.id, { x: c.x, y: c.y }]));
}

/**
 * Re-frames `box` so its content sits inside the part of a `width` x `height`
 * pixel viewport that is not covered by an overlay: `left` pixels reserved on
 * the left edge and `bottom` pixels on the bottom edge. Returns a viewBox with
 * the viewport's own aspect ratio, so the on-screen scale is exactly the one
 * that fits `box` into the free area. Used to keep the popup from hiding pins.
 */
export function reserveBox(box: Box, width: number, height: number, left: number, bottom: number): Box {
  if (width <= 0 || height <= 0 || (left <= 0 && bottom <= 0)) return box;
  const availW = Math.max(width - Math.max(left, 0), width * 0.3);
  const availH = Math.max(height - Math.max(bottom, 0), height * 0.3);
  const scale = Math.min(availW / box.w, availH / box.h);
  const offsetX = width - availW + (availW - box.w * scale) / 2;
  const offsetY = (availH - box.h * scale) / 2;
  return { x: box.x - offsetX / scale, y: box.y - offsetY / scale, w: width / scale, h: height / scale };
}
