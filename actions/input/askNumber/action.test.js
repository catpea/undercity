/**
 * action.test.js — Unit tests for input.askNumber
 * Ask for Number: Show a modal with a numeric input field.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'input.askNumber — is exported from runtime',
    run(RT) {
      const ns = RT.Input ?? RT.input;
      if (!ns) throw new Error('Namespace Input/input not found in runtime');
      if (typeof ns.askNumber !== 'function') throw new Error('input.askNumber is not a function');
    },
  },

  {
    name: 'input.askNumber — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Input.askNumber?.("Age", 0, 999);
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
