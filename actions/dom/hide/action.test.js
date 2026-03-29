/**
 * action.test.js — Unit tests for dom.hide
 * Hide Element: Add d-none class to matching elements.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'dom.hide — is exported from runtime',
    run(RT) {
      const ns = RT.Dom ?? RT.dom;
      if (!ns) throw new Error('Namespace Dom/dom not found in runtime');
      if (typeof ns.hide !== 'function') throw new Error('dom.hide is not a function');
    },
  },

  {
    name: 'dom.hide — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Dom.hide?.("#my-div");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
