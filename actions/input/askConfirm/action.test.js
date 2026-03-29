/**
 * action.test.js — Unit tests for input.askConfirm
 * Ask for Confirmation: Show a yes/no confirmation dialog. Stores boolean.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'input.askConfirm — is exported from runtime',
    run(RT) {
      const ns = RT.Input ?? RT.input;
      if (!ns) throw new Error('Namespace Input/input not found in runtime');
      if (typeof ns.askConfirm !== 'function') throw new Error('input.askConfirm is not a function');
    },
  },

  {
    name: 'input.askConfirm — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Input.askConfirm?.("Are you sure?");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
