// library/room/showNav/af-show-navigation-buttons.js
//
// <af-show-navigation-buttons variant="primary" size="lg" outline full group>
//
// Renders Bootstrap 5.3 navigation buttons for every room exit registered in
// window._PW_NAV (populated by Room.exits()). Supports the complete Bootstrap
// button API plus button-group mode.
//
// Observed attributes:
//   variant  — Bootstrap color: primary secondary success danger warning
//              info light dark link  (default: "primary")
//   outline  — boolean presence — use btn-outline-{variant} instead of btn-{variant}
//   size     — "sm" | "lg" | "" (default) — maps to btn-sm / btn-lg
//   full     — boolean presence — block/full-width buttons (w-100 / flex-fill)
//   group    — boolean presence — wrap in .btn-group (connected buttons)
//
// Light DOM — Bootstrap page styles apply directly to rendered buttons.
//
// When `group` is present buttons are joined into a Bootstrap .btn-group.
// When `group` + `full` the group gets w-100 and each button gets flex-fill
// so all exits share equal width across the full container.
//
// Without `group`, buttons are stacked (full) or wrapped (not full) with gap-2.

import { Signal } from 'framework';
import { Scope }  from 'scope';

class AfShowNavigationButtons extends HTMLElement {
  static observedAttributes = ['variant', 'outline', 'size', 'full', 'group'];

  // ── Signal model (one Signal per observed attribute) ──────────────────────
  #variant = new Signal('primary');
  #outline = new Signal(false);
  #size    = new Signal('');
  #full    = new Signal(false);
  #group   = new Signal(false);

  #scope = new Scope();

  // ── Attribute → Signal ────────────────────────────────────────────────────

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    switch (attr) {
      case 'variant': this.#variant.value = next || 'primary'; break;
      case 'outline': this.#outline.value = next !== null;     break;
      case 'size':    this.#size.value    = next || '';        break;
      case 'full':    this.#full.value    = next !== null;     break;
      case 'group':   this.#group.value   = next !== null;     break;
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connectedCallback() {
    const combined = Signal.combineLatest([
      this.#variant, this.#outline, this.#size, this.#full, this.#group,
    ]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([variant, outline, size, full, group]) => {
      this.#render(variant, outline, size, full, group);
    }));
  }

  disconnectedCallback() {
    this.#scope.dispose();
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  #render(variant, outline, size, full, group) {
    const nav = window._PW_NAV ?? [];

    this.innerHTML = '';
    if (!nav.length) return;

    const btnVariant = outline ? `btn-outline-${variant}` : `btn-${variant}`;
    const btnSize    = size ? `btn-${size}` : '';

    if (group) {
      this.#renderGroup(nav, btnVariant, btnSize, full);
    } else {
      this.#renderStack(nav, btnVariant, btnSize, full);
    }
  }

  /** Button group — connected buttons in a single Bootstrap .btn-group. */
  #renderGroup(nav, btnVariant, btnSize, full) {
    const group = document.createElement('div');
    group.setAttribute('role', 'group');
    // w-100 makes the group fill its container; flex-fill on each button
    // distributes available space equally across all exits.
    group.className = ['btn-group', full ? 'w-100' : ''].filter(Boolean).join(' ');

    for (const entry of nav) {
      group.appendChild(this.#makeButton(entry, [
        'btn',
        btnVariant,
        btnSize,
        full ? 'flex-fill' : '',  // equal-width share inside the group
        'fw-semibold',
      ]));
    }

    this.appendChild(group);
  }

  /** Stacked / wrapped — independent buttons with spacing. */
  #renderStack(nav, btnVariant, btnSize, full) {
    const wrap = document.createElement('div');
    wrap.className = full
      ? 'd-flex flex-column gap-2'   // vertical stack, each button full-width
      : 'd-flex flex-wrap gap-2';    // horizontal wrap

    for (const entry of nav) {
      wrap.appendChild(this.#makeButton(entry, [
        'btn',
        btnVariant,
        btnSize,
        full ? 'w-100' : '',
        'fw-semibold',
      ]));
    }

    this.appendChild(wrap);
  }

  /** Build a single navigation button element. */
  #makeButton(entry, classes) {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = classes.filter(Boolean).join(' ');
    btn.textContent = entry.label;
    btn.addEventListener('click', () => entry.call());
    return btn;
  }
}

customElements.define('af-show-navigation-buttons', AfShowNavigationButtons);
export { AfShowNavigationButtons };
