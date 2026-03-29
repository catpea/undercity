/**
 * action.test.js — Unit tests for input.askPassword
 * Ask for Password: Show a masked password input modal.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'input.askPassword — is exported from runtime',
    run(RT) {
      const ns = RT.Input ?? RT.input;
      if (!ns) throw new Error('Namespace Input/input not found in runtime');
      if (typeof ns.askPassword !== 'function') throw new Error('input.askPassword is not a function');
    },
  },

  {
    name: 'input.askPassword — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Input.askPassword?.("Enter password");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
