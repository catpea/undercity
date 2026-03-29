/**
 * action.test.js — Unit tests for logic.transform
 * Transform Value: Evaluate a JS expression and store the result.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'logic.transform — is exported from runtime',
    run(RT) {
      const ns = RT.Logic ?? RT.logic;
      if (!ns) throw new Error('Namespace Logic/logic not found in runtime');
      if (typeof ns.transform !== 'function') throw new Error('logic.transform is not a function');
    },
  },

  {
    name: 'logic.transform — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Logic.transform?.("inventory.items.length");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
