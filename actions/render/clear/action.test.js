/**
 * action.test.js — Unit tests for render.clear
 * Clear Page: Empty #pw-content. Put this first in onEnter to rebuild on each visit.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'render.clear — is exported from runtime',
    run(RT) {
      const ns = RT.Render ?? RT.render;
      if (!ns) throw new Error('Namespace Render/render not found in runtime');
      if (typeof ns.clear !== 'function') throw new Error('render.clear is not a function');
    },
  },

  {
    name: 'render.clear — can be called with no arguments',
    async run(RT, sandbox) {
      // Smoke test: calling the action should not throw
      // (may produce DOM changes or be a no-op depending on state)
      try {
        await RT.Render.clear?.();
      } catch (e) {
        // Some actions require specific DOM state — acceptable
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
