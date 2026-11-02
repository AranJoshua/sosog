import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MUNICIPALITY_BOUNDARIES } from '../components/map/boundaries.js';
import {
  project,
  pathBox,
  unionBoxes,
  pointBoxes,
  padBox,
  lerpBox,
  boxToViewBox,
  easeInOut,
  declutter,
  ringLayout,
  reserveBox,
  MAP_SIZE,
  MAP_HEIGHT
} from './map-geometry.js';
import { BOUNDS } from '../components/map/boundaries.js';

describe('project', () => {
  test('maps the province corners onto the 800 x MAP_HEIGHT space', () => {
    const topLeft = project(13.1577, 123.4393);
    assert.ok(Math.abs(topLeft.x) < 1e-9 && Math.abs(topLeft.y) < 1e-9);
    const bottomRight = project(12.4976, 124.2412);
    assert.ok(Math.abs(bottomRight.x - MAP_SIZE) < 1e-6 && Math.abs(bottomRight.y - MAP_HEIGHT) < 1e-6);
  });

  test('keeps the real shape: a unit of ground distance spans the same number of SVG units east-west and north-south', () => {
    // One degree of longitude is cos(latitude) times as long as one degree of latitude.
    const centreLat = (BOUNDS.minLat + BOUNDS.maxLat) / 2;
    const unitsPerDegreeLng = MAP_SIZE / (BOUNDS.maxLng - BOUNDS.minLng);
    const unitsPerDegreeLat = MAP_HEIGHT / (BOUNDS.maxLat - BOUNDS.minLat);
    const eastWestPerKm = unitsPerDegreeLng / Math.cos((centreLat * Math.PI) / 180);
    const northSouthPerKm = unitsPerDegreeLat;
    assert.ok(Math.abs(eastWestPerKm / northSouthPerKm - 1) < 0.002, `ratio was ${eastWestPerKm / northSouthPerKm}`);
  });

  test('does not clamp points outside the province box', () => {
    const offshore = project(12.7530677, 124.2812294);
    assert.ok(offshore.x > MAP_SIZE);
  });
});

describe('pathBox', () => {
  test('finds the bounding box of an M/L/Z path', () => {
    const box = pathBox('M 10 20 L 50 5 L 30 80 Z');
    assert.deepEqual(box, { x: 10, y: 5, w: 40, h: 75 });
  });

  test('every real municipality path sits inside the province box', () => {
    for (const b of MUNICIPALITY_BOUNDARIES) {
      const box = pathBox(b.d);
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.w <= MAP_SIZE && box.y + box.h <= MAP_HEIGHT, b.name);
      assert.ok(box.w > 0 && box.h > 0, b.name);
    }
  });
});

describe('box helpers', () => {
  test('unionBoxes includes every box and point', () => {
    const union = unionBoxes([{ x: 0, y: 0, w: 800, h: 800 }, ...pointBoxes([{ x: 840, y: 400 }])]);
    assert.equal(union.x, 0);
    assert.equal(union.w, 840);
    assert.equal(union.h, 800);
  });

  test('padBox grows evenly and enforces a minimum size around the centre', () => {
    const padded = padBox({ x: 100, y: 100, w: 10, h: 10 }, 5, 100);
    assert.equal(padded.w, 100);
    assert.equal(padded.h, 100);
    assert.equal(padded.x + padded.w / 2, 105);
    assert.equal(padded.y + padded.h / 2, 105);
  });

  test('lerpBox and easeInOut hit their endpoints', () => {
    const a = { x: 0, y: 0, w: 100, h: 100 };
    const b = { x: 50, y: 50, w: 200, h: 200 };
    assert.deepEqual(lerpBox(a, b, 0), a);
    assert.deepEqual(lerpBox(a, b, 1), b);
    assert.equal(easeInOut(0), 0);
    assert.equal(easeInOut(1), 1);
    assert.ok(easeInOut(0.5) === 0.5);
  });

  test('boxToViewBox formats four numbers', () => {
    assert.equal(boxToViewBox({ x: 1.234, y: 2, w: 3, h: 4.5678 }), '1.23 2 3 4.57');
  });
});

describe('declutter', () => {
  test('separates pins that share identical coordinates', () => {
    const pins = [
      { id: 'a', x: 100, y: 100 },
      { id: 'b', x: 100, y: 100 },
      { id: 'c', x: 100, y: 100 }
    ];
    const out = declutter(pins, 20);
    const ids = ['a', 'b', 'c'];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const p = out.get(ids[i])!;
        const q = out.get(ids[j])!;
        assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 18, `${ids[i]} and ${ids[j]} still overlap`);
      }
    }
  });

  test('leaves pins that are already far apart exactly where they are', () => {
    const out = declutter([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 500, y: 500 }], 20);
    assert.deepEqual(out.get('a'), { x: 0, y: 0 });
    assert.deepEqual(out.get('b'), { x: 500, y: 500 });
  });

  test('never moves a pin further than maxShift and is repeatable', () => {
    const pins = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, x: 50, y: 50 }));
    const first = declutter(pins, 20, 40);
    const second = declutter(pins, 20, 40);
    for (const p of pins) {
      const moved = first.get(p.id)!;
      assert.ok(Math.hypot(moved.x - 50, moved.y - 50) <= 40 + 1e-9);
      assert.deepEqual(moved, second.get(p.id));
    }
  });
});

describe('reserveBox', () => {
  const box = { x: 100, y: 200, w: 200, h: 100 };

  test('returns the box untouched when nothing is reserved', () => {
    assert.deepEqual(reserveBox(box, 800, 600, 0, 0), box);
  });

  test('keeps the content clear of a reserved left strip', () => {
    const view = reserveBox(box, 800, 600, 344, 0);
    const scale = 800 / view.w;
    const contentLeftPx = (box.x - view.x) * scale;
    const contentRightPx = (box.x + box.w - view.x) * scale;
    assert.ok(contentLeftPx >= 344 - 1e-6, `content starts at ${contentLeftPx}px`);
    assert.ok(contentRightPx <= 800 + 1e-6);
    assert.ok(Math.abs(view.w / view.h - 800 / 600) < 1e-9, 'keeps the viewport aspect ratio');
  });

  test('keeps the content clear of a reserved bottom strip', () => {
    const view = reserveBox(box, 400, 700, 0, 420);
    const scale = 700 / view.h;
    const contentBottomPx = (box.y + box.h - view.y) * scale;
    assert.ok(contentBottomPx <= 700 - 420 + 1e-6, `content ends at ${contentBottomPx}px`);
  });
});

describe('ringLayout', () => {
  const PIN = 34;
  const pairwiseMin = (placed: Map<string, { x: number; y: number }>) => {
    const pts = [...placed.values()];
    let min = Infinity;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) min = Math.min(min, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
    return min;
  };

  test('leaves pins that have room to themselves exactly where they are, with no hub', () => {
    const { placed, hubs } = ringLayout([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 400, y: 0 }], PIN);
    assert.deepEqual(placed.get('a'), { x: 0, y: 0 });
    assert.deepEqual(placed.get('b'), { x: 400, y: 0 });
    assert.equal(hubs.length, 0);
  });

  test('places crowded pins evenly around one hub, clear of each other and of the hub', () => {
    const crowd = [
      { id: 'a', x: 100, y: 100 },
      { id: 'b', x: 104, y: 98 },
      { id: 'c', x: 99, y: 106 },
      { id: 'd', x: 103, y: 103 }
    ];
    const { placed, hubs } = ringLayout(crowd, PIN);
    assert.equal(hubs.length, 1);
    assert.deepEqual([...hubs[0].ids].sort(), ['a', 'b', 'c', 'd']);
    assert.ok(pairwiseMin(placed) >= PIN * 1.3 - 1e-6, 'pins crowd each other');
    for (const id of hubs[0].ids) {
      const p = placed.get(id)!;
      assert.ok(Math.hypot(p.x - hubs[0].x, p.y - hubs[0].y) >= PIN * 0.98 - 1e-6, 'a pin covers the hub');
    }
  });

  test('handles identical coordinates and gives the same answer every time', () => {
    const same = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, x: 50, y: 50 }));
    const first = ringLayout(same, PIN);
    const second = ringLayout(same, PIN);
    assert.ok(pairwiseMin(first.placed) >= PIN * 1.3 - 1e-6);
    assert.deepEqual([...first.placed], [...second.placed]);
    assert.deepEqual(first.hubs, second.hubs);
  });

  test('keeps a lone pin out of a nearby cluster and still separates two clusters that touch', () => {
    const { placed } = ringLayout(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 3, y: 0 },
        { id: 'c', x: 90, y: 0 },
        { id: 'd', x: 93, y: 0 }
      ],
      PIN
    );
    assert.ok(pairwiseMin(placed) >= PIN * 1.3 - 1e-6);
  });
});
