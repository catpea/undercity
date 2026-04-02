// ── Shared page DOM helpers ────────────────────────────────────────────────────
// Shared by Actions, Render, Media, and Input.
//
// _pwContainer()      — resolves the main content root for the current template
// _pwCardBody()       — returns (or creates) the last Bootstrap card body
// _pwRegisterBinding  — registers field-binding cleanup for pagehide

// ── Binding registry (live-sync cleanup) ──────────────────────────────────────
const _pwBindings = [];
export function _pwRegisterBinding(fn) { _pwBindings.push(fn); }
window.addEventListener('pagehide', () => { _pwBindings.forEach(fn => fn()); _pwBindings.length = 0; });

// ── Container resolution ───────────────────────────────────────────────────────
// Resolution order:
//   1. #pw-content  — blank-template rooms (render.* target)
//   2. #pw-form     — form-template rooms
//   3. main#pw-main .container-* — default/null-template rooms
//   4. document.body — absolute last resort
export function _pwContainer() {
  return document.getElementById('pw-content')
      ?? document.getElementById('pw-form')
      ?? document.querySelector('main#pw-main [class*="container"]')
      ?? document.body;
}

/** Insert child into parent before #pw-nav-card so nav stays pinned at bottom. */
export function _pwInsert(parent, child) {
  const nav = parent.querySelector?.(':scope > #pw-nav-card') ?? null;
  parent.insertBefore(child, nav);
}

/** Return the .card-body of the last content card, creating a new card if none exists. */
export function _pwCardBody() {
  const root  = _pwContainer();
  const cards = [...root.querySelectorAll(':scope > .card:not(#pw-nav-card)')];
  if (cards.length) return cards[cards.length - 1].querySelector(':scope > .card-body');
  const card = document.createElement('div');
  card.className = 'card mb-3';
  const body = document.createElement('div');
  body.className = 'card-body';
  card.appendChild(body);
  _pwInsert(root, card);
  return body;
}
