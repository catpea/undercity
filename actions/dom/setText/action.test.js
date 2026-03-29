/**
 * action.test.js — Unit tests for dom.setText
 * Set Text: Set the textContent of matching elements.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'dom.setText — is exported from runtime',
    run(RT) {
      const ns = RT.Dom ?? RT.dom;
      if (!ns) throw new Error('Namespace Dom/dom not found in runtime');
      if (typeof ns.setText !== 'function') throw new Error('dom.setText is not a function');
    },
  },

  {
    name: 'dom.setText — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Dom.setText?.("#my-label", "inventory.firstName");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
