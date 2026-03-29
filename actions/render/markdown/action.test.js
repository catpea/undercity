/**
 * action.test.js — Unit tests for render.markdown
 * Markdown Block: Append a rendered Markdown block to the page.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'render.markdown — is exported from runtime',
    run(RT) {
      const ns = RT.Render ?? RT.render;
      if (!ns) throw new Error('Namespace Render/render not found in runtime');
      if (typeof ns.markdown !== 'function') throw new Error('render.markdown is not a function');
    },
  },

  {
    name: 'render.markdown — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Render.markdown?.("**Bold** and _italic_…");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
