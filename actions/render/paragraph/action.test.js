/**
 * action.test.js — Unit tests for render.paragraph
 * Paragraph: Append a styled paragraph of text.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'render.paragraph — is exported from runtime',
    run(RT) {
      const ns = RT.Render ?? RT.render;
      if (!ns) throw new Error('Namespace Render/render not found in runtime');
      if (typeof ns.paragraph !== 'function') throw new Error('render.paragraph is not a function');
    },
  },

  {
    name: 'render.paragraph — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Render.paragraph?.("Body copy…", "muted");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
