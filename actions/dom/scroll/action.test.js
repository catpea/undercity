/**
 * action.test.js — Unit tests for dom.scroll
 * Scroll To Element: Smoothly scroll the selector into view.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'dom.scroll — is exported from runtime',
    run(RT) {
      const ns = RT.Dom ?? RT.dom;
      if (!ns) throw new Error('Namespace Dom/dom not found in runtime');
      if (typeof ns.scroll !== 'function') throw new Error('dom.scroll is not a function');
    },
  },

  {
    name: 'dom.scroll — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Dom.scroll?.("", "start");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
