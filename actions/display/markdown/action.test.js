/**
 * action.test.js — Unit tests for display.markdown
 * Print Markdown: Render a Markdown string as HTML inside a selector.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'display.markdown — is exported from runtime',
    run(RT) {
      const ns = RT.Display ?? RT.display;
      if (!ns) throw new Error('Namespace Display/display not found in runtime');
      if (typeof ns.markdown !== 'function') throw new Error('display.markdown is not a function');
    },
  },

  {
    name: 'display.markdown — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Display.markdown?.("#my-area", "**Bold** and _italic_");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
