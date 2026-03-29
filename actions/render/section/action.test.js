/**
 * action.test.js — Unit tests for render.section
 * Section Header: Append a small uppercase section divider label.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'render.section — is exported from runtime',
    run(RT) {
      const ns = RT.Render ?? RT.render;
      if (!ns) throw new Error('Namespace Render/render not found in runtime');
      if (typeof ns.section !== 'function') throw new Error('render.section is not a function');
    },
  },

  {
    name: 'render.section — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Render.section?.("Personal Details");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
