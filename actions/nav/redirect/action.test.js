/**
 * action.test.js — Unit tests for nav.redirect
 * Redirect URL: Navigate to an absolute or relative URL.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'nav.redirect — is exported from runtime',
    run(RT) {
      const ns = RT.Nav ?? RT.nav;
      if (!ns) throw new Error('Namespace Nav/nav not found in runtime');
      if (typeof ns.redirect !== 'function') throw new Error('nav.redirect is not a function');
    },
  },

  {
    name: 'nav.redirect — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Nav.redirect?.("https://…", "_self");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
