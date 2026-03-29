/**
 * action.test.js — Unit tests for dom.addClass
 * Add Class: Add one or more CSS classes.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'dom.addClass — is exported from runtime',
    run(RT) {
      const ns = RT.Dom ?? RT.dom;
      if (!ns) throw new Error('Namespace Dom/dom not found in runtime');
      if (typeof ns.addClass !== 'function') throw new Error('dom.addClass is not a function');
    },
  },

  {
    name: 'dom.addClass — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Dom.addClass?.("", "is-active text-info");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
