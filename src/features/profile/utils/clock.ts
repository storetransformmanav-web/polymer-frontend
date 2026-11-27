/** Whole seconds as `m:ss`. */
export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** The moment `seconds` from now, or null when there is no limit. */
export const deadline = (seconds: number | null) =>
  seconds === null ? null : Date.now() + seconds * 1000

/** Whole seconds left until `time` (never below 0), or null when there is no limit. */
export const secondsUntil = (time: number | null, now: number) =>
  time === null ? null : Math.max(0, Math.ceil((time - now) / 1000))
