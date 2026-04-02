// ── Namespace registry ────────────────────────────────────────────────────────
// _NS maps action namespace strings to runtime objects (used by runPayload).
// registerNamespace() lets plugins inject additional namespaces at load time.
export const _NS = {};
export function registerNamespace(name, obj) {
  _NS[name] = obj;
  _NS[name.toLowerCase()] = obj;
}
