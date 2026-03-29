/**
 * action.test.js — Unit tests for dom.removeClass
 * Remove Class: Remove one or more CSS classes.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'dom.removeClass — is exported from runtime',
    run(RT) {
      const ns = RT.Dom ?? RT.dom;
      if (!ns) throw new Error('Namespace Dom/dom not found in runtime');
      if (typeof ns.removeClass !== 'function') throw new Error('dom.removeClass is not a function');
    },
  },

  {
    name: 'dom.removeClass — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Dom.removeClass?.("", "");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
