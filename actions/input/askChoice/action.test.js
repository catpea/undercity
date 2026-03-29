/**
 * action.test.js — Unit tests for input.askChoice
 * Ask for Choice: Present a list of options as a radio-button modal.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'input.askChoice — is exported from runtime',
    run(RT) {
      const ns = RT.Input ?? RT.input;
      if (!ns) throw new Error('Namespace Input/input not found in runtime');
      if (typeof ns.askChoice !== 'function') throw new Error('input.askChoice is not a function');
    },
  },

  {
    name: 'input.askChoice — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Input.askChoice?.("Choose one", "Red,Green,Blue");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
