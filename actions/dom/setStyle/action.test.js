/**
 * action.test.js — Unit tests for dom.setStyle
 * Set Inline Style: Set a CSS property directly.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'dom.setStyle — is exported from runtime',
    run(RT) {
      const ns = RT.Dom ?? RT.dom;
      if (!ns) throw new Error('Namespace Dom/dom not found in runtime');
      if (typeof ns.setStyle !== 'function') throw new Error('dom.setStyle is not a function');
    },
  },

  {
    name: 'dom.setStyle — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Dom.setStyle?.("", "color", "#268bd2");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
