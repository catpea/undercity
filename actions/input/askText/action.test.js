/**
 * action.test.js — Unit tests for input.askText
 * Ask for Text Input: Show a modal asking the user to type a text value.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'input.askText — is exported from runtime',
    run(RT) {
      const ns = RT.Input ?? RT.input;
      if (!ns) throw new Error('Namespace Input/input not found in runtime');
      if (typeof ns.askText !== 'function') throw new Error('input.askText is not a function');
    },
  },

  {
    name: 'input.askText — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Input.askText?.("Your name", "Type here…", false);
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
