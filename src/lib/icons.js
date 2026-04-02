// src/lib/icons.js
//
// Icon name utilities used by the server and generator.
// The <af-icon> web component lives in src/ide/af-icons.js.

const ICON_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DEFAULT_ICON_NAME = 'stars';

/** Validate and return a clean Bootstrap Icon name, or the fallback. */
export function normalizeIconName(value, fallback = DEFAULT_ICON_NAME) {
  if (typeof value !== 'string') return fallback;
  const name = value.trim().toLowerCase();
  return ICON_NAME_RE.test(name) ? name : fallback;
}
