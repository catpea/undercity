/**
 * action.test.js — Unit tests for logic.random
 * Random Number: Store a random number (integer or float) in inventory.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'logic.random — is exported from runtime',
    run(RT) {
      const ns = RT.Logic ?? RT.logic;
      if (!ns) throw new Error('Namespace Logic/logic not found in runtime');
      if (typeof ns.random !== 'function') throw new Error('logic.random is not a function');
    },
  },

  {
    name: 'logic.random — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Logic.random?.(0, 100, true);
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
