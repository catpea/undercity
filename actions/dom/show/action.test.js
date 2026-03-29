/**
 * action.test.js — Unit tests for dom.show
 * Show Element: Remove d-none / display:none from matching elements.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'dom.show — is exported from runtime',
    run(RT) {
      const ns = RT.Dom ?? RT.dom;
      if (!ns) throw new Error('Namespace Dom/dom not found in runtime');
      if (typeof ns.show !== 'function') throw new Error('dom.show is not a function');
    },
  },

  {
    name: 'dom.show — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Dom.show?.("#my-div");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
