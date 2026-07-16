/**
 * Reversible module-hide flags.
 *
 * The "tasks" and "wiki" modules are unused (no data to preserve). They are hidden
 * from the ENTIRE UI + Telegram surface, but NOTHING is deleted — every hide point
 * gates on one of these flags. Flip a flag back to `false` and rebuild to fully
 * restore that module (nav, routes, dashboard quick-actions, Telegram command,
 * task-creation, the conferences "View in Wiki" link).
 *
 * Deliberately NOT touched even when hidden (they read/write harmlessly in the
 * background): the conference report generator (still creates wiki pages — just
 * unreachable), wiki/ask (degrades gracefully with no pages), and the passive
 * task-stat readers (dashboard count / Sentinel chat / digest stat — they read 0,
 * never error). Hide those separately later if wanted.
 */
// Typed `boolean` (not the literal `true`) so gates read as runtime conditions —
// avoids no-constant-condition lint + TS dead-code narrowing at every hide point.
export const TASKS_HIDDEN: boolean = true
export const WIKI_HIDDEN: boolean = true
