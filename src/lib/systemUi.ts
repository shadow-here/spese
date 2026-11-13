/**
 * System screens Spese opens itself — the file picker (restore), share sheet (export), print
 * dialog, notification permission and Face ID / fingerprint prompts — can briefly hide the app.
 * That isn't "leaving Spese", so the instant app lock ignores it. Call allowSystemUi() right
 * before opening one; the next hide within 30 s doesn't lock.
 */
const WINDOW_MS = 30_000
let until = 0

export function allowSystemUi(): void {
  until = Date.now() + WINDOW_MS
}

export function isSystemUiExpected(): boolean {
  return Date.now() < until
}

export function clearSystemUi(): void {
  until = 0
}
