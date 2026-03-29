/**
 * action.test.js — Unit tests for render.subtitle
 * Subtitle: Append a muted subtitle paragraph.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'render.subtitle — is exported from runtime',
    run(RT) {
      const ns = RT.Render ?? RT.render;
      if (!ns) throw new Error('Namespace Render/render not found in runtime');
      if (typeof ns.subtitle !== 'function') throw new Error('render.subtitle is not a function');
    },
  },

  {
    name: 'render.subtitle — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Render.subtitle?.("Welcome back. Enter your credentials.");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
