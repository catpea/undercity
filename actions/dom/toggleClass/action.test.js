/**
 * action.test.js — Unit tests for dom.toggleClass
 * Toggle Class: Toggle a CSS class on matching elements.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'dom.toggleClass — is exported from runtime',
    run(RT) {
      const ns = RT.Dom ?? RT.dom;
      if (!ns) throw new Error('Namespace Dom/dom not found in runtime');
      if (typeof ns.toggleClass !== 'function') throw new Error('dom.toggleClass is not a function');
    },
  },

  {
    name: 'dom.toggleClass — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Dom.toggleClass?.("", "");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
