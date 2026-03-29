/**
 * action.test.js — Unit tests for dom.toggle
 * Toggle Visibility: Toggle d-none on matching elements.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'dom.toggle — is exported from runtime',
    run(RT) {
      const ns = RT.Dom ?? RT.dom;
      if (!ns) throw new Error('Namespace Dom/dom not found in runtime');
      if (typeof ns.toggle !== 'function') throw new Error('dom.toggle is not a function');
    },
  },

  {
    name: 'dom.toggle — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Dom.toggle?.("");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
