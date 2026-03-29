/**
 * action.test.js — Unit tests for input.askDate
 * Ask for Date: Show a date-picker modal.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'input.askDate — is exported from runtime',
    run(RT) {
      const ns = RT.Input ?? RT.input;
      if (!ns) throw new Error('Namespace Input/input not found in runtime');
      if (typeof ns.askDate !== 'function') throw new Error('input.askDate is not a function');
    },
  },

  {
    name: 'input.askDate — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Input.askDate?.("Select a date");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
