/**
 * action.test.js — Unit tests for logic.if
 * If / Else: Conditionally run a block of steps.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'logic.if — is exported from runtime',
    run(RT) {
      const ns = RT.Logic ?? RT.logic;
      if (!ns) throw new Error('Namespace Logic/logic not found in runtime');
      if (typeof ns.if !== 'function') throw new Error('logic.if is not a function');
    },
  },

  {
    name: 'logic.if — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Logic.if?.("inventory.age >= 18", "", "");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
