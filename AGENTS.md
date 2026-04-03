# Undercity — AGENTS.md

---

## ⛔ LOW QUALITY WORK IS NOT PERMITTED

Every UI control, component, and API surface must be implemented correctly and to the highest standard. There are no shortcuts. Wrong controls, broken inputs, misleading labels, or half-implemented features are unacceptable. Review every detail before committing.

### UI Control Standards — Use the Right Control for the Job

| Data / Need                              | Correct Control                                      | NEVER use                         |
|------------------------------------------|------------------------------------------------------|-----------------------------------|
| Boolean on/off (single flag)             | `<input type="checkbox">`                            | `<select>` with "true"/"false"    |
| Exclusive choice, ≤5 fixed options       | `<input type="radio">` group                         | Free-text input                   |
| Exclusive choice, >5 or dynamic options  | `<select>` (pop-up button / combobox)                | Radio group with 10+ items        |
| Multiple independent flags               | Multiple `<input type="checkbox">` inputs            | A single `<select multiple>`      |
| Short free text (single line)            | `<input type="text">` (with `placeholder`)           | `<textarea>` with `rows="1"`      |
| Long free text / code / multiline        | `<textarea>` (explicit `rows`)                       | `<input type="text">`             |
| Numeric value                            | `<input type="number">` (with `min`/`max`/`step`)    | `<input type="text">`             |
| Color variant / Bootstrap class          | `<select>` listing all valid tokens                  | Free text (typos break rendering) |

**Rule**: if a value is boolean, it MUST be a checkbox. No exceptions.

---

## DO NOT INSTALL NPM DEPENDENCIES

npm packages are unsafe and should not be installed

## PUSH ARCHITECTURE

use Signal, combineLatest, Scope, Events, Disposable, CompositeDisposable, Repeater and similar

See src/lib/signal.js src/lib/scope.js

## USE WEB COMPONENTS

Use web-components/custom-elements to create reusable and portable code

---

## Web Component Pattern — The Law

Every action that produces visible output in a generated page **must** be implemented
as a named web component. This is not optional. It is the architecture.

### Why

Generated pages are customer-facing. When a customer (or their developer) opens
DevTools, they see:

```html
<af-ask-for-text key="email" label="Email address" required></af-ask-for-text>
<af-display-value key="avatar"></af-display-value>
<af-show-navigation-buttons variant="primary" full></af-show-navigation-buttons>
```

This is readable, intentional, and professional. Raw `<div><label><input>` soup
is not. The component is the documentation.

### Naming Convention

```
af-<action-label-kebab>.js
```

Examples:
- Action "Ask For Long Text"         → `af-ask-for-long-text.js`       tag: `<af-ask-for-long-text>`
- Action "Inventory Dump"            → `af-inventory-dump.js`           tag: `<af-inventory-dump>`
- Action "Show Navigation Buttons"   → `af-show-navigation-buttons.js`  tag: `<af-show-navigation-buttons>`
- Action "Display Value"             → `af-display-value.js`            tag: `<af-display-value>`

File lives alongside `library.js` in the action directory:

```
library/
  input/
    longText/
      action.json
      library.js                   ← IDE-side runner (imports the component)
      af-ask-for-long-text.js      ← THE component (used in generated pages too)
  room/
    showNav/
      action.json
      library.js
      af-show-navigation-buttons.js
```

### Two Deployment Contexts

The same `af-*.js` file runs in **both** contexts:

| Context        | How loaded                                  | Inventory access              |
|---------------|----------------------------------------------|-------------------------------|
| IDE (savant)  | `import './af-*.js'` from `library.js`       | `globalThis.Inventory`        |
| Generated page | `js/components.js` barrel (auto-generated)  | `globalThis.Inventory`        |

`globalThis.Inventory` is the singleton set at the bottom of `inventory.js`.
Components must use it directly — never through `ctx`.

### Bare Specifier Importmap

In generated pages, an importmap in `<head>` maps:

```json
{ "imports": { "framework": "./js/signal.js", "scope": "./js/scope.js" } }
```

Components import Signal and Scope using bare specifiers:

```js
import { Signal, on } from 'framework';
import { Scope }      from 'scope';
```

This works in generated pages (via importmap) and in the IDE (Vite resolves them).
**Never import from relative paths that differ between the two contexts.**

### Canonical Component Template

```js
// library/<category>/<action>/af-<tag>.js
//
// <af-tag key="myKey" label="My Label" required>
//
// Observed attributes:
//   key      — Inventory key (required)
//   label    — human-readable label (defaults to key)
//   required — boolean presence attribute
//
// Two-way binding via globalThis.Inventory. Shadow DOM with Bootstrap-compatible styles.

import { Signal, on } from 'framework';
import { Scope }      from 'scope';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; margin-bottom: 1rem; }
    label { display: block; margin-bottom: .25rem; font-size: .875rem; font-weight: 500; color: var(--bs-body-color, #dee2e6); }
    input {
      display: block; width: 100%; padding: .375rem .75rem;
      font-size: 1rem; line-height: 1.5;
      color: var(--bs-body-color, #dee2e6);
      background-color: var(--bs-body-bg, #212529);
      border: 1px solid var(--bs-border-color, #495057);
      border-radius: .375rem; box-sizing: border-box;
      transition: border-color .15s, box-shadow .15s;
    }
    input:focus { outline: 0; border-color: #86b7fe; box-shadow: 0 0 0 .25rem rgba(13,110,253,.25); }
  </style>
  <label part="label"></label>
  <input part="input" type="text">
`;

class AfTag extends HTMLElement {
  static observedAttributes = ['key', 'label', 'required'];

  // ── Signal model (one Signal per observed attribute) ─────────────────────
  #key      = new Signal('');
  #label    = new Signal('');
  #required = new Signal(false);

  #scope  = new Scope();
  #labelEl;
  #inputEl;

  constructor() {
    super();
    const root    = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#labelEl = root.querySelector('[part="label"]');
    this.#inputEl = root.querySelector('[part="input"]');
  }

  // ── Attribute → Signal ──────────────────────────────────────────────────
  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')      this.#key.value      = next ?? '';
    if (attr === 'label')    this.#label.value    = next ?? '';
    if (attr === 'required') this.#required.value = next !== null;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────
  connectedCallback() {
    // combineLatest drives view sync whenever any attribute signal changes
    const combined = Signal.combineLatest([this.#key, this.#label, this.#required]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, required]) => {
      // sync view
      const id = `af-tag-${key || 'field'}`;
      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', id);
      this.#inputEl.id   = id;
      this.#inputEl.name = key;
      if (required) this.#inputEl.setAttribute('required', '');
      else          this.#inputEl.removeAttribute('required');

      // rebind Inventory subscription whenever key changes
      // Named child scope 'inv' is disposed/refilled on each key change
      this.#scope.scope('inv').dispose();
      if (key && globalThis.Inventory?.subscribe) {
        this.#scope.scope('inv').add(
          globalThis.Inventory.subscribe(key, v => {
            const nv = String(v ?? '');
            if (this.#inputEl.value !== nv) this.#inputEl.value = nv;
          })
        );
      }
    }));

    // DOM → Inventory (on() returns a Disposable, scope.add() cleans it up)
    this.#scope.add(on(this.#inputEl, 'input', () => {
      const key = this.#key.peek();
      if (key) globalThis.Inventory?.set(key, this.#inputEl.value);
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }
}

customElements.define('af-tag', AfTag);
export { AfTag };
```

### Key Rules

1. **One Signal per observed attribute.** `attributeChangedCallback` writes to the Signal. Never write to the DOM directly from `attributeChangedCallback` — the Signal subscription handles that.

2. **`Signal.combineLatest` in `connectedCallback`.** Combines all attribute Signals into one subscription that syncs the View. Add the combined signal to scope so it's disposed on disconnect.

3. **Named child scope for Inventory rebinding.** Use `this.#scope.scope('inv').dispose()` then refill it inside the combineLatest subscription when the `key` attribute changes. This is the canonical pattern for subscriptions that must be replaced when a param changes.

4. **`on(el, event, handler)` for DOM events.** The `on()` helper from `'framework'` returns a `Disposable`. Pass it to `this.#scope.add()`. Never call `removeEventListener` manually — scope cleanup handles it.

5. **`disconnectedCallback` calls `this.#scope.dispose()`.** Always. No exceptions.

6. **Shadow DOM for input components.** Scoped styles prevent Bootstrap from leaking in or out. Use `part="..."` attributes for testability.

7. **Light DOM for display components.** `af-display-text`, `af-display-value`, `af-display-markdown` etc. use Light DOM (`this.innerHTML = ...`) so page-level styles apply.

8. **Components are caller-agnostic.** They read `globalThis.Inventory` directly. They do NOT receive `ctx`. They do NOT know whether they are in the IDE or a generated page.

9. **Pre-process before setting attributes.** If the component displays pre-rendered content (e.g. markdown HTML), the CALLER renders it before setting the attribute. The component is a dumb view. Example: `display.js` calls `_renderMd()` then `el.setAttribute('html', renderedHtml)`.

10. **`new-action.js` scaffolds both files.** Running `node library/new-action.js --category foo --name myAction` creates both `library.js` AND `af-my-action.js`. Always fill in both.

### Corresponding `library.js` Pattern

The IDE-side `library.js` imports the component and creates an element:

```js
import { Emitter } from 'framework';
import './af-tag.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-tag');
  if (params.key)   el.setAttribute('key',   params.key);
  if (params.label) el.setAttribute('label', params.label);
  if (params.required) el.setAttribute('required', '');
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
```

### Corresponding Runtime Method Pattern

The generated-page runtime method (in `src/generator/runtime/input.js` or `display.js`) creates the same element:

```js
myAction(key, label = '', required = false) {
  const el = document.createElement('af-tag');
  el.setAttribute('key', key);
  if (label)    el.setAttribute('label', label);
  if (required) el.setAttribute('required', '');
  _pwCardBody().appendChild(el);
},
```

### Generator — Automatic Component Discovery

`src/generator/index.js` automatically walks `library/*/*/af-*.js`, copies every
file it finds to `js/components/` in the generated output, and generates a
`js/components.js` barrel that imports all of them. The page shell includes:

```html
<script type="module" src="js/components.js"></script>
```

This means: **any `af-*.js` file placed inside any `library/category/action/`
directory is automatically available in every generated page.** No registration
step needed.

---

## The MUD Agent Model

Undercity's architecture is grounded in the **Multi-User Dungeon (MUD) metaphor**:

- **Rooms** have events (incl. user defined events), can contain Things.
- **The User** moves through rooms carrying an **Inventory** of data.
- **Things** are objects that inhabit rooms — they react to events, modify inventory, and trigger actions without user input.
- **Events** are the lifecycle hooks of each room: `onEnter`, `onExit`, `onBack`, `onReset`, `onUnload`.

This model gives Undercity a natural, coherent extension path: **any new feature can be framed as a room object, thing, or event type.**

---

## Why MUD?

The MUD metaphor was chosen because it provides:

- **A coherent vocabulary** for all stakeholders (rooms, users, inventory, things)
- **A proven extension model** — MUDs have supported objects, things, events, and multiplayer for 40+ years
- **Natural debugging** — you can "walk" through the flow as an user, inspect inventory at each room, and trace room events
- **A path to AI** — LLM agents fit naturally as NPCs or guides inhabiting rooms
- **Compatibility** — new features (auth, persistence, realtime) map to well-understood MUD concepts

**The MUD metaphor is the conceptual foundation of Undercity. Preserve it in all architectural decisions.**
