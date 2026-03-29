/**
 * action.test.js — Unit tests for display.safeHtml
 * Print Safe HTML: Sanitize and inject HTML — script/event attributes stripped.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'display.safeHtml — is exported from runtime',
    run(RT) {
      const ns = RT.Display ?? RT.display;
      if (!ns) throw new Error('Namespace Display/display not found in runtime');
      if (typeof ns.safeHtml !== 'function') throw new Error('display.safeHtml is not a function');
    },
  },

  {
    name: 'display.safeHtml — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Display.safeHtml?.("#my-area", "<b>Bold</b>");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
