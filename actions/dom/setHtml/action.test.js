/**
 * action.test.js — Unit tests for dom.setHtml
 * Set Inner HTML: Set innerHTML of matching elements.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'dom.setHtml — is exported from runtime',
    run(RT) {
      const ns = RT.Dom ?? RT.dom;
      if (!ns) throw new Error('Namespace Dom/dom not found in runtime');
      if (typeof ns.setHtml !== 'function') throw new Error('dom.setHtml is not a function');
    },
  },

  {
    name: 'dom.setHtml — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Dom.setHtml?.("", "");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
