/**
 * action.test.js — Unit tests for input.askEmail
 * Ask for Email: Show a modal with an email-validated input field.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'input.askEmail — is exported from runtime',
    run(RT) {
      const ns = RT.Input ?? RT.input;
      if (!ns) throw new Error('Namespace Input/input not found in runtime');
      if (typeof ns.askEmail !== 'function') throw new Error('input.askEmail is not a function');
    },
  },

  {
    name: 'input.askEmail — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Input.askEmail?.("Your email");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
