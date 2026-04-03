# Undercity — Code Style Guide

**Agents: this document is mandatory reading. Every rule here is enforced.
Violations will be caught in review and sent back for rewrite.**

---

## Table of Contents

1. [No npm Packages](#1-no-npm-packages)
2. [Web Components — MDN Conventions](#2-web-components--mdn-conventions)
3. [Push Architecture — Never Poll](#3-push-architecture--never-poll)
4. [Programming Primitives — `src/lib/`](#4-programming-primitives--srclib)
   - Signal
   - Signal.combineLatest()
   - Signal.derive()
   - Signal.from()
   - Emitter
   - Disposable
   - CompositeDisposable
   - Repeater
   - DisposableEventBinder
   - on()
5. [Scope Trees — `src/lib/scope.js`](#5-scope-trees--srclibscopejs)
6. [State Machines — `src/lib/state-machine.js`](#6-state-machines--srclibstate-machinejs)
7. [Inventory Access Pattern](#7-inventory-access-pattern)
8. [Importing the Primitives](#8-importing-the-primitives)

---

## 1. No npm Packages

**Do not install npm packages. Do not add entries to `package.json` `dependencies`
or `devDependencies` for runtime or component code.**

### Why

Every npm package is a supply-chain attack surface. A single compromised
transitive dependency can silently exfiltrate user data, inject code, or break
the build. Undercity runs in browsers and handles user files — the risk is
unacceptable.

### What to do instead

Write the code yourself. Our primitives in `src/lib/` cover reactive state,
events, DOM binding, cleanup, keyed list rendering, and state machines. If you
need something that isn't there, add it to `src/lib/` and document it here.

```
❌ import confetti from 'canvas-confetti';
❌ import { debounce } from 'lodash-es';
❌ import Fuse from 'fuse.js';

✅ Write it. 20 lines of focused code beats a 200 KB dependency.
```

---

## 2. Web Components — MDN Conventions

All reusable UI in this project is written as **Custom Elements** following the
[MDN Web Components guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_components).

### Why Web Components

- They are a W3C standard — no framework churn, no breaking upgrades.
- They are self-documenting in DevTools: `<af-ask-for-text key="email">` is
  readable by any developer.
- Shadow DOM scopes styles so Bootstrap never bleeds in or out.
- `disconnectedCallback` is the browser's own cleanup hook — no manual teardown
  bookkeeping when elements are removed.

### The canonical component skeleton

Every component in this project follows this exact structure. Do not deviate.

```js
// library/<category>/<action>/af-<action-tag>.js
//
// <af-action-tag attr1="…" attr2="…">
//
// Observed attributes:
//   attr1 — description
//   attr2 — description
//
// Reads globalThis.Inventory. Works in the Savant IDE and in generated pages.

import { Signal, on } from 'framework';
import { Scope }      from 'scope';

// ── Template ──────────────────────────────────────────────────────────────────
// Defined once at module scope, cloned per instance in the constructor.
// Never build template HTML inside connectedCallback — it runs on every reconnect.

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; }
    /* component-scoped styles only — Bootstrap classes are not available here */
  </style>
  <!-- markup with part="…" attributes for external styling and testability -->
`;

// ── Component class ───────────────────────────────────────────────────────────

class AfActionTag extends HTMLElement {
  // Declare every observed attribute here.
  // attributeChangedCallback only fires for attributes in this list.
  static observedAttributes = ['attr1', 'attr2'];

  // One Signal per observed attribute.
  // Signals are the source of truth — the DOM is a projection of them.
  #attr1 = new Signal('');
  #attr2 = new Signal(false);

  // One Scope for the component's entire lifetime.
  // All subscriptions and event listeners go through it.
  #scope = new Scope();

  // DOM refs — resolved once in the constructor, never queried again.
  #someEl;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    // Capture refs immediately after cloning — do NOT use querySelector in
    // connectedCallback or event handlers.
    this.#someEl = root.querySelector('[part="some-el"]');
  }

  // ── Attributes → Signals ───────────────────────────────────────────────────
  // Only update the corresponding Signal. Never touch the DOM here.
  // The Signal subscription (set up in connectedCallback) updates the DOM.

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'attr1') this.#attr1.value = next ?? '';
    if (attr === 'attr2') this.#attr2.value = next !== null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback() {
    // combineLatest merges all attribute Signals into one.
    // The subscription fires immediately (autorun = true) so the view is
    // populated on first connect without needing a separate init call.
    const attrs = Signal.combineLatest([this.#attr1, this.#attr2]);
    this.#scope.add(attrs);                         // dispose the combiner
    this.#scope.add(attrs.subscribe(([a1, a2]) => {
      // Update DOM from current signal values.
      this.#someEl.textContent = a1;
    }));

    // DOM event → Signal/Inventory (use on() helper, not addEventListener)
    this.#scope.add(on(this.#someEl, 'click', () => {
      // handle the event
    }));
  }

  disconnectedCallback() {
    // Always. One call cleans up everything added to this.#scope.
    this.#scope.dispose();
  }
}

customElements.define('af-action-tag', AfActionTag);
export { AfActionTag };
```

### Rules — no exceptions

| Rule | Detail |
|------|--------|
| `static observedAttributes` | Declare every attribute the component reads. Without this, `attributeChangedCallback` never fires for that attribute. |
| One Signal per attribute | `attributeChangedCallback` writes only to its Signal. Never write to the DOM directly from there. |
| Template at module scope | `document.createElement('template')` once, cloned in `constructor`. Never rebuild it in `connectedCallback`. |
| DOM refs in constructor | Query `[part="…"]` elements once in the constructor. Store them in private fields. |
| `combineLatest` in `connectedCallback` | Use `Signal.combineLatest` to combine attribute Signals into one subscription that syncs the whole view. |
| `scope.add(combined)` before `scope.add(combined.subscribe(…))` | The combiner must be disposed before its subscriber. Order matters. |
| `on()` for DOM events | `on(el, 'event', handler)` returns a Disposable. Pass it to `scope.add()`. Never call `removeEventListener` by hand. |
| `disconnectedCallback` calls `scope.dispose()` | Always. Every subscription, every event listener, every timer must go through the scope. |
| Shadow DOM for input components | Scoped styles. Use `part="…"` attributes. |
| Light DOM for display components | `this.innerHTML = …` so page-level styles apply to the content. |
| `globalThis.Inventory` directly | Components never receive `ctx`. They read inventory through the global singleton. |

---

## 3. Push Architecture — Never Poll

This codebase uses a **push** architecture. Data flows from its source to all
consumers the moment it changes. Consumers never ask "what is the value right
now?" — they declare "call me when the value changes."

### The wrong way — pull

```js
❌  // Polling: wastes CPU, always slightly stale
setInterval(() => {
  const value = someObject.getValue();
  el.textContent = value;
}, 100);

❌  // Manual read on click: misses changes between clicks
button.addEventListener('click', () => {
  const v = inventory['myKey'];
  doSomethingWith(v);
});
```

### The right way — push

```js
✅  // Subscribe: fires immediately, then on every change
const sub = signal.subscribe(value => {
  el.textContent = value;          // DOM is always in sync, zero polling
});
scope.add(sub);                    // cleaned up when component disconnects
```

```js
✅  // Inventory push: react to a specific key
scope.add(
  globalThis.Inventory.subscribe('myKey', value => {
    el.textContent = String(value ?? '');
  })
);
```

```js
✅  // Multiple signals: react to any of them changing
const combined = Signal.combineLatest([sigA, sigB]);
scope.add(combined);
scope.add(combined.subscribe(([a, b]) => {
  el.textContent = `${a} — ${b}`;
}));
```

The rule: **if you are reading a value rather than subscribing to it, stop and
ask why.** The only legitimate reads are one-time initialization (constructor)
and `peek()` inside an event handler where you need the current value without
wanting to subscribe.

---

## 4. Programming Primitives — `src/lib/`

All primitives are imported via bare specifier `'framework'` (maps to
`src/lib/signal.js`) or `'scope'` (maps to `src/lib/scope.js`).

```js
import { Signal, Emitter, Disposable, CompositeDisposable,
         Repeater, DisposableEventBinder, on } from 'framework';
import { Scope } from 'scope';
```

---

### Signal

A reactive value cell. Holds one value. Notifies all subscribers when the value
changes. The fundamental unit of state in this codebase.

```js
const count = new Signal(0);

// Subscribe: fn fires immediately with current value (autorun = true by default)
const sub = count.subscribe(v => console.log('count is', v));  // → "count is 0"

count.value = 1;   // → "count is 1"
count.value = 1;   // no-op — same value, no notification

sub.dispose();     // stop receiving updates

count.peek();      // read current value WITHOUT subscribing
```

**`autorun = false`** — defer the first fire:

```js
const sub = count.subscribe(v => console.log(v), false);  // does NOT fire immediately
count.value = 5;   // fires now for the first time → "5"
```

**`signal.notify()`** — force-notify all subscribers without changing the value.
Use after in-place mutations of objects/arrays:

```js
const list = new Signal([]);
list.value.push('item');   // mutation — Signal doesn't know it changed
list.notify();             // force push to all subscribers
```

---

### Signal.combineLatest()

Combines an array of Signals into one Signal whose value is an array of all
their current values. Fires when **any** input Signal changes.

```js
const name  = new Signal('Alice');
const score = new Signal(42);

const combined = Signal.combineLatest([name, score]);
// combined.value === ['Alice', 42]

combined.subscribe(([n, s]) => {
  console.log(`${n}: ${s}`);   // → "Alice: 42"
});

score.value = 99;   // → "Alice: 99"
name.value  = 'Bob'; // → "Bob: 99"

// IMPORTANT: dispose the combined signal itself, not just its subscriptions.
// The combined signal registers its own internal subscriptions on the inputs.
combined.dispose();
```

**Always add the combined signal to scope before adding its subscription:**

```js
✅
const combined = Signal.combineLatest([this.#a, this.#b]);
this.#scope.add(combined);                        // disposes internal subs
this.#scope.add(combined.subscribe(([a, b]) => { /* update DOM */ }));

❌
this.#scope.add(combined.subscribe(([a, b]) => { /* … */ }));
// combined's internal subscriptions on this.#a and this.#b are never cleaned up
```

---

### Signal.derive()

Creates a new Signal whose value is a transformation of a source Signal.
Updates automatically when the source changes.

```js
const celsius    = new Signal(100);
const fahrenheit = Signal.derive(celsius, c => c * 9/5 + 32);

fahrenheit.subscribe(f => console.log(f + '°F'));   // → "212°F"
celsius.value = 0;                                  // → "32°F"

fahrenheit.dispose();   // cleans up the internal subscription on celsius
scope.add(fahrenheit);  // or let scope manage it
```

Shorthand via the instance method:

```js
const fahrenheit = celsius.map(c => c * 9/5 + 32);
```

---

### Signal.from()

Wraps a Promise as a Signal. Starts at `initial`, updates when the Promise
resolves.

```js
const data = Signal.from(fetch('/api/data').then(r => r.json()), null);

data.subscribe(v => {
  if (v === null) { el.textContent = 'Loading…'; return; }
  el.textContent = JSON.stringify(v);
});
```

---

### Emitter

A typed event bus. Use it for one-to-many communication where consumers
should not hold a reference to the producer.

```js
const emitter = new Emitter();

// Listen: returns a Disposable
const sub = emitter.on('save', filename => console.log('saved', filename));

emitter.emit('save', 'document.txt');   // → "saved document.txt"
emitter.emit('save', 'notes.txt');      // → "saved notes.txt"

sub.dispose();                          // stop listening
emitter.emit('save', 'ignored.txt');    // nothing fires
```

**Every `library.js` action `run()` function returns an Emitter.** This is the
contract between an action and its caller:

```js
export function run(params, ctx) {
  const emitter = new Emitter();

  const el = document.createElement('af-my-component');
  emitter.emit('render', el);   // tells caller: "here is your element"
  emitter.emit('done');         // tells caller: "I am finished"

  return emitter;   // return BEFORE any async work
}
```

Standard events: `render` (payload: HTMLElement), `done` (optional result),
`error` (payload: Error).

---

### Disposable

A single cleanup handle. Wraps any cleanup function so it can be passed to
`scope.add()`, `CompositeDisposable`, etc.

```js
const d = new Disposable(() => console.log('cleaned up'));
d.dispose();   // → "cleaned up"
d.dispose();   // no-op — idempotent
```

You rarely construct Disposables directly. Signal.subscribe(), Emitter.on(), and
on() all return them.

---

### CompositeDisposable

Groups multiple Disposables and disposes them all in **reverse order** (LIFO)
with a single call.

```js
const cd = new CompositeDisposable();

cd.add(sigA.subscribe(v => /* … */));
cd.add(sigB.subscribe(v => /* … */));
cd.add(emitter.on('event', fn));

cd.dispose();   // disposes in reverse order: emitter sub → sigB sub → sigA sub
cd.dispose();   // no-op — idempotent
```

Use `CompositeDisposable` when you need a flat group without named children.
Use `Scope` when you need named sub-groups (see below).

---

### Repeater

Keyed list renderer. Reconciles add/remove/reorder operations against a DOM
container **without clearing it**. Drives the DOM from a `Signal<array>`.

```js
const items = new Signal([
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
]);

function renderItem(item) {
  const li = document.createElement('li');
  li.textContent = item.label;
  return li;
}

// key defaults to item.id. Can be a function: { key: item => item.uuid }
const repeater = new Repeater(ulElement, items, renderItem);
scope.add(repeater);   // Repeater implements dispose()

items.value = [
  { id: 'b', label: 'Beta' },    // 'a' removed, 'b' kept, no DOM recreation
  { id: 'c', label: 'Gamma' },   // 'c' added
];
```

`Repeater` implements `.dispose()` so it can be passed directly to `scope.add()`.

---

### DisposableEventBinder

Attaches a DOM event listener and wraps it as a Disposable. Prefer the `on()`
helper below for new code — `DisposableEventBinder` is available for cases where
you need more configuration options.

```js
const binder = new DisposableEventBinder(inputEl, 'input', handler);
scope.add(binder);

// To stop: binder.dispose() — removes the event listener
```

---

### on()

The standard way to add a DOM event listener in component code. Returns a
Disposable. Pass it to `scope.add()` — never call `removeEventListener` by hand.

```js
import { on } from 'framework';

// In connectedCallback:
this.#scope.add(on(this.#inputEl, 'input', () => {
  globalThis.Inventory?.set(this.#key.peek(), this.#inputEl.value);
}));

this.#scope.add(on(this.#btnEl, 'click', e => {
  e.preventDefault();
  this.#handleSubmit();
}));
```

`on(target, type, handler, opts)` maps exactly to
`target.addEventListener(type, handler, opts)`, and disposal calls
`target.removeEventListener(type, handler, opts)`.

---

## 5. Scope Trees — `src/lib/scope.js`

A `Scope` is a named tree of cleanup resources. It disposes children
depth-first, then its own resources in LIFO order. Use it to manage the lifetime
of any component, service, or subscription group.

### Why Scope instead of CompositeDisposable

`CompositeDisposable` is a flat list. `Scope` adds **named child scopes**, which
lets you selectively tear down part of a component's state without destroying the
whole thing. This is essential for rebinding — when a `key` attribute changes,
only the Inventory subscription needs to be replaced, not every DOM event listener.

### Basic usage

```js
import { Scope } from 'scope';

const scope = new Scope('my-component');

// Add any cleanup resource:
scope.add(signal.subscribe(fn));          // Disposable from subscribe()
scope.add(emitter.on('event', fn));       // Disposable from on()
scope.add(on(el, 'click', handler));      // Disposable from on() helper
scope.add(() => clearTimeout(timerId));   // plain function
scope.add(repeater);                      // object with .dispose() method

scope.dispose();   // runs ALL of the above in reverse order
```

### Named child scopes — the rebinding pattern

This is the most important use of Scope. When a component attribute changes and
a subscription must be replaced, you do not want to tear down the entire
component — just the subscription that belongs to that attribute.

```js
class AfSomeThing extends HTMLElement {
  #scope = new Scope('af-some-thing');

  connectedCallback() {
    const key = Signal.combineLatest([this.#key]);
    this.#scope.add(key);
    this.#scope.add(key.subscribe(([k]) => {

      // Dispose ONLY the 'inv' child scope, then refill it.
      // All other subscriptions in this.#scope are untouched.
      this.#scope.scope('inv').dispose();
      if (k) {
        this.#scope.scope('inv').add(
          globalThis.Inventory.subscribe(k, v => {
            this.#inputEl.value = String(v ?? '');
          })
        );
      }
    }));
  }

  disconnectedCallback() {
    this.#scope.dispose();   // disposes 'inv' child first, then everything else
  }
}
```

### Scope lifecycle rules

- Each component has **one root Scope** as a private field (`#scope`).
- `disconnectedCallback` calls `#scope.dispose()`. Always. One call.
- Named child scopes (`scope.scope('name')`) are created lazily on first access.
  After `dispose()` the child is empty but the slot still exists — you can
  `scope.scope('name').add(…)` again immediately.
- Never create a new Scope in `connectedCallback`. The root scope is created at
  class field initialisation and lives for the component's full lifetime.

---

## 6. State Machines — `src/lib/state-machine.js`

Use `createMachine` when a component has branching logic that depends on
**which state it is in**. Without a state machine, this logic drifts into
forests of `if/else` and scattered boolean flags — and agents introduce bugs
when they misread the combination of flags.

### When to use it

- A component moves through a sequence of named states (idle → submitting →
  verifying → done / error).
- What a user action does depends on the current state ("submit" only works in
  `idle`; "retry" only works in `error`).
- Multiple boolean flags that are always in sync (e.g. `dirty` and `saving`
  are never both true at once).

### API

```js
import { createMachine } from 'state-machine';

const machine = createMachine({
  // context: one Signal per key, accessible as machine.<key>
  state: {
    busy:    false,
    percent: 0,
    message: '',
  },

  initial: 'idle',

  states: {
    idle: {
      enter: { busy: false, percent: 0, message: '' },
      on: { submit: 'submitting' },
    },
    submitting: {
      enter: { busy: true, message: 'Uploading…' },
      on: {
        'submit-ok':   'verifying',
        'submit-fail': 'error',
      },
    },
    verifying: {
      enter: { message: 'Verifying…' },
      on: {
        'verify-ok':   'done',
        'verify-fail': 'error',
      },
    },
    done: {
      enter: { busy: false, percent: 100, message: 'Done.' },
      on: {},
    },
    error: {
      // enter values can be functions — receive { payload, machine, current }
      enter: { busy: false, message: ({ payload }) => payload?.message ?? 'Error.' },
      on: { retry: 'idle' },
    },
  },
});

// Each context key is a live Signal — subscribe to it directly
machine.busy.subscribe(v    => submitBtn.disabled = v);
machine.percent.subscribe(v  => progressBar.style.width = v + '%');
machine.message.subscribe(v  => statusEl.textContent = v);
machine.current.subscribe(s  => el.dataset.state = s);

// Drive the machine with emit()
machine.emit('submit');          // idle → submitting; busy = true
machine.emit('submit-ok');       // submitting → verifying; message = 'Verifying…'
machine.emit('verify-ok');       // verifying → done; percent = 100
machine.emit('verify-fail',
  { message: 'Checksum failed.' }); // verifying → error; message from payload
```

### MapSet

`state-machine.js` also exports `MapSet` — a `Map<key, Set<value>>` useful for
multi-listener registries. Use it when you need to group multiple values under
one key without duplicates.

```js
import { MapSet } from 'state-machine';

const listeners = new MapSet();
listeners.add('click', handlerA);
listeners.add('click', handlerB);
listeners.get('click');   // Set { handlerA, handlerB }
listeners.delete('click', handlerA);
```

---

## 7. Inventory Access Pattern

`globalThis.Inventory` is the singleton set at the bottom of
`src/generator/runtime/inventory.js`. It is the same object in both the Savant
IDE and generated pages.

### Reading all keys

```js
✅  globalThis.Inventory?.get()          // { ...all data } — shallow copy of live data
                                          // preserves live Blob/File references

❌  globalThis.Inventory?.snapshot?.()   // does not exist
❌  globalThis.Inventory?.data           // does not exist
❌  globalThis.Inventory?.dump()         // round-trips through JSON — loses Blobs
```

### Reading one key

```js
✅  globalThis.Inventory?.get('myKey')
✅  globalThis.Inventory?.get()['myKey']  // if you already called get()
```

### Writing one key

```js
✅  globalThis.Inventory?.set('myKey', value)
```

### Subscribing to one key

```js
✅  const sub = globalThis.Inventory.subscribe('myKey', v => {
      el.textContent = String(v ?? '');
    });
    scope.add(sub);
```

### Subscribing to ALL keys

```js
✅  const sub = globalThis.Inventory.subscribeAll(data => {
      // data is { ...all keys } — fires immediately, then on every write
    });
    scope.add(sub);
```

---

## 8. Importing the Primitives

All source files in `library/` and `src/` import via bare specifiers. The
importmap in the page `<head>` resolves them.

```js
// signal.js primitives
import { Signal, Emitter, Disposable, CompositeDisposable,
         Repeater, DisposableEventBinder, on } from 'framework';

// scope.js
import { Scope } from 'scope';

// state-machine.js (when you need state machines or MapSet)
import { createMachine, MapSet } from 'state-machine';
```

The importmap (set in `src/generator/page.js`):

```json
{
  "imports": {
    "framework":     "./js/signal.js",
    "scope":         "./js/scope.js",
    "form-field":    "./js/form-field.js"
  }
}
```

`state-machine` is not in the default importmap because it is imported only
by components that need it. Those components must add it when used.

**Never import using relative paths that differ between the IDE and generated
pages.** The bare specifier + importmap pattern is the one path that works in
both contexts.

---

*See also: `AGENTS.md` (architecture), `library/AGENTS.md` (action library rules).*
