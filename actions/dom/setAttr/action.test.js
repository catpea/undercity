/**
 * action.test.js — Unit tests for dom.setAttr
 * Set Attribute: Set an attribute on matching elements.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'dom.setAttr — is exported from runtime',
    run(RT) {
      const ns = RT.Dom ?? RT.dom;
      if (!ns) throw new Error('Namespace Dom/dom not found in runtime');
      if (typeof ns.setAttr !== 'function') throw new Error('dom.setAttr is not a function');
    },
  },

  {
    name: 'dom.setAttr — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Dom.setAttr?.("", "src", "\"https://…\"");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
