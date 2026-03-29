/**
 * action.test.js — Unit tests for logic.delay
 * Delay: Pause execution for N milliseconds.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'logic.delay — is exported from runtime',
    run(RT) {
      const ns = RT.Logic ?? RT.logic;
      if (!ns) throw new Error('Namespace Logic/logic not found in runtime');
      if (typeof ns.delay !== 'function') throw new Error('logic.delay is not a function');
    },
  },

  {
    name: 'logic.delay — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Logic.delay?.(500);
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
