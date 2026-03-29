/**
 * action.test.js — Unit tests for nav.goto
 * Go To Room: Navigate the user to another room in the flow.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'nav.goto — is exported from runtime',
    run(RT) {
      const ns = RT.Nav ?? RT.nav;
      if (!ns) throw new Error('Namespace Nav/nav not found in runtime');
      if (typeof ns.goto !== 'function') throw new Error('nav.goto is not a function');
    },
  },

  {
    name: 'nav.goto — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Nav.goto?.("room-id");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
