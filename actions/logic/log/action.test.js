/**
 * action.test.js — Unit tests for logic.log
 * Log to Console: console.log a message or expression.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'logic.log — is exported from runtime',
    run(RT) {
      const ns = RT.Logic ?? RT.logic;
      if (!ns) throw new Error('Namespace Logic/logic not found in runtime');
      if (typeof ns.log !== 'function') throw new Error('logic.log is not a function');
    },
  },

  {
    name: 'logic.log — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Logic.log?.("\"Value: \" + inventory.myKey");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
