import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { frameSeconds } from './motion.js';

/** The deck's easing step, as written in stories.astro. */
const ease = (pos: number, target: number, dt: number) => pos + (target - pos) * (1 - Math.exp(-dt * 8));

describe('frameSeconds', () => {
  test('converts milliseconds to seconds', () => {
    assert.equal(frameSeconds(1016, 1000), 0.016);
  });

  test('caps a long frame at the maximum step', () => {
    assert.equal(frameSeconds(2000, 1000), 0.05);
  });

  test('never returns a negative step when the frame timestamp precedes the last one', () => {
    for (const gap of [1, 9, 40, 300, 900]) {
      const dt = frameSeconds(1000, 1000 + gap);
      assert.ok(dt > 0, `gap ${gap} ms gave ${dt}`);
    }
  });

  test('falls back for equal or non-finite timestamps', () => {
    assert.equal(frameSeconds(1000, 1000), 0.016);
    assert.equal(frameSeconds(Number.NaN, 1000), 0.016);
  });

  test('an easing step never moves the deck away from its target, even after a slow first frame', () => {
    // The previous formula, Math.min(0.05, (now - last) / 1000 || 0.016), sent pos 11 towards target 12 to about 1.
    const oldDt = Math.min(0.05, (1000 - 1300) / 1000 || 0.016);
    assert.ok(ease(11, 12, oldDt) < 2, 'documents the old failure');
    const pos = ease(11, 12, frameSeconds(1000, 1300));
    assert.ok(pos > 11 && pos <= 12, `pos was ${pos}`);
  });
});
