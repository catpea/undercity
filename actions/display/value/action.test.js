/**
 * action.test.js — Unit tests for display.value
 * Show Inventory Value: Print an inventory key's value as text into a selector.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'display.value — is exported from runtime',
    run(RT) {
      const ns = RT.Display ?? RT.display;
      if (!ns) throw new Error('Namespace Display/display not found in runtime');
      if (typeof ns.value !== 'function') throw new Error('display.value is not a function');
    },
  },

  {
    name: 'display.value — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Display.value?.("#name-label", "firstName");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
