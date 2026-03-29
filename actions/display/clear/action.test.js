/**
 * action.test.js — Unit tests for display.clear
 * Clear Content: Empty the innerHTML of a selector.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'display.clear — is exported from runtime',
    run(RT) {
      const ns = RT.Display ?? RT.display;
      if (!ns) throw new Error('Namespace Display/display not found in runtime');
      if (typeof ns.clear !== 'function') throw new Error('display.clear is not a function');
    },
  },

  {
    name: 'display.clear — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Display.clear?.("#my-area");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
