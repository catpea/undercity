/**
 * action.test.js — Unit tests for dom.focus
 * Focus Element: Move keyboard focus to a selector.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'dom.focus — is exported from runtime',
    run(RT) {
      const ns = RT.Dom ?? RT.dom;
      if (!ns) throw new Error('Namespace Dom/dom not found in runtime');
      if (typeof ns.focus !== 'function') throw new Error('dom.focus is not a function');
    },
  },

  {
    name: 'dom.focus — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Dom.focus?.("");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
