/**
 * scope.js — Hierarchical resource management.
 *
 * Inspired by dirge (github.com/nicholasgasior/dirge).
 * A Scope holds cleanup callbacks in a named tree.
 * On dispose(), children run first (depth-first), then local resources LIFO.
 *
 * Accepts three cleanup resource shapes:
 *   function      — called directly
 *   { dispose }   — Disposable from signal.js (subscription, event handle)
 *   { [Symbol.dispose] } — TC39 explicit resource management
 *
 * Usage — package lifecycle:
 *
 *   let _scope = null;
 *
 *   export function activate(env) {
 *     _scope = new Scope('my-package');
 *
 *     const opener = env.workspace.addOpener(uri => { ... });
 *     _scope.add(() => opener.dispose());
 *
 *     const handler = () => { ... };
 *     document.addEventListener('my-event', handler);
 *     _scope.add(() => document.removeEventListener('my-event', handler));
 *   }
 *
 *   export function deactivate() {
 *     _scope?.dispose();   // all resources cleaned up in one call
 *     _scope = null;
 *   }
 *
 * Usage — child scopes for different lifetimes:
 *
 *   // Per-render listeners that must be replaced on next render:
 *   const perRender = this.#scope.scope('per-render');
 *   perRender.dispose();             // remove previous listeners
 *   perRender.add(() => el.removeEventListener('dragover', onDragover));
 *
 *   // The parent scope disposes all children on its own dispose().
 */

export class Scope {
  #fns      = [];
  #children = new Map(); // name → Scope

  /**
   * Add a cleanup resource. Returns `this` for fluent chaining.
   *   scope.add(signal.subscribe(fn))
   *   scope.add(() => el.removeEventListener('click', handler))
   */
  add(resource) {
    this.#fns.push(resource);
    return this;
  }

  /**
   * Get or create a named child scope.
   * The child disposes before this scope's own resources.
   * Calling scope.scope(name).dispose() clears only that child;
   * scope.scope(name) again returns the same (now empty) child.
   */
  scope(name) {
    if (!this.#children.has(name)) this.#children.set(name, new Scope());
    return this.#children.get(name);
  }

  /**
   * Dispose all children (depth-first), then local resources (LIFO).
   * After disposal the scope is empty and can be reused.
   */
  dispose() {
    for (const child of this.#children.values()) child.dispose();
    // Don't clear children Map — named children remain accessible for reuse.
    // (Their resources are empty after dispose; adding to them works again.)

    for (let i = this.#fns.length - 1; i >= 0; i--) {
      const r = this.#fns[i];
      try {
        if (typeof r === 'function') r();
        else r?.dispose?.() ?? r?.[Symbol.dispose]?.();
      } catch (err) {
        console.error('[Scope] dispose error:', err);
      }
    }
    this.#fns.length = 0;
  }
}
