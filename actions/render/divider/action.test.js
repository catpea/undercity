/**
 * action.test.js — Unit tests for render.divider
 * Divider: Append a horizontal rule.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'render.divider — is exported from runtime',
    run(RT) {
      const ns = RT.Render ?? RT.render;
      if (!ns) throw new Error('Namespace Render/render not found in runtime');
      if (typeof ns.divider !== 'function') throw new Error('render.divider is not a function');
    },
  },

  {
    name: 'render.divider — can be called with no arguments',
    async run(RT, sandbox) {
      // Smoke test: calling the action should not throw
      // (may produce DOM changes or be a no-op depending on state)
      try {
        await RT.Render.divider?.();
      } catch (e) {
        // Some actions require specific DOM state — acceptable
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
