/**
 * action.test.js — Unit tests for user.check
 * Check Condition: Evaluate a JS expression against inventory. Branch via diamond.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'user.check — is exported from runtime',
    run(RT) {
      const ns = RT.User ?? RT.user;
      if (!ns) throw new Error('Namespace User/user not found in runtime');
      if (typeof ns.check !== 'function') throw new Error('user.check is not a function');
    },
  },

  {
    name: 'user.check — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.User.check?.("inventory.age >= 18");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
