/**
 * Seconds to advance an animation by on this frame, from the browser's frame
 * timestamp `now` and the timestamp of the previous step `last`, both in
 * milliseconds.
 *
 * The result is never negative and never above `max`. A negative step is
 * possible: a frame's timestamp is the start of that frame, which can come
 * earlier than the `performance.now()` value taken when a click started the
 * animation, and on a slow device the gap can be hundreds of milliseconds.
 * An easing step written as `pos += (target - pos) * (1 - exp(-dt * 8))`
 * turns a negative `dt` into a large push away from the target, which threw
 * the Feature Stories deck to the wrong card on the first frame after a click.
 */
export function frameSeconds(now: number, last: number, max = 0.05, fallback = 0.016): number {
  const seconds = (now - last) / 1000;
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return Math.min(max, seconds);
}
