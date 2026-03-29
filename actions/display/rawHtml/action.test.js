/**
 * action.test.js — Unit tests for display.rawHtml
 * Print Raw HTML: Inject trusted HTML directly (no sanitization). Use only with controlled content.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'display.rawHtml — is exported from runtime',
    run(RT) {
      const ns = RT.Display ?? RT.display;
      if (!ns) throw new Error('Namespace Display/display not found in runtime');
      if (typeof ns.rawHtml !== 'function') throw new Error('display.rawHtml is not a function');
    },
  },

  {
    name: 'display.rawHtml — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Display.rawHtml?.("#my-area", "<b>Trusted HTML</b>");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
