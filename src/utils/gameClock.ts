/**
 * Global in-game clock used to timestamp all console output.
 *
 * GameScene updates the clock as the night progresses. A one-time console
 * patch prepends the current in-game time (e.g. [1:24AM]) to every
 * console.log/warn/error call in the entire game.
 */

let clockHours24 = 0;   // 0 = 12AM
let clockMinutes = 0;

/**
 * Update the global game clock (called by GameScene each tick / on night start)
 */
export function setGameClock(hours24: number, minutes: number): void {
  clockHours24 = hours24;
  clockMinutes = minutes;
}

/**
 * Format the current game time like the in-game HUD, e.g. "12:08AM", "1:24AM"
 */
export function getGameTimeString(): string {
  const h = clockHours24 === 0 ? 12 : clockHours24;
  const m = clockMinutes.toString().padStart(2, '0');
  return `${h}:${m}AM`;
}

/**
 * Patch console.log/warn/error so every call is prefixed with the current
 * in-game time.
 *
 * Uses a property getter that returns the ORIGINAL console method bound with
 * the timestamp prefix. Because the function actually invoked is the native
 * console method, DevTools still attributes each log to the real caller's
 * file and line (e.g. SpyEnemy.ts:106) instead of this wrapper.
 */
export function installTimestampedConsole(): void {
  (['log', 'warn', 'error'] as const).forEach((method) => {
    const original = console[method].bind(console);
    Object.defineProperty(console, method, {
      configurable: true,
      get: () => original.bind(console, `[${getGameTimeString()}]`),
    });
  });
}
