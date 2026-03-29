/**
 * action.test.js — Unit tests for user.get
 * Read Inventory Item: Read a value and optionally alias it.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'user.get — is exported from runtime',
    run(RT) {
      const ns = RT.User ?? RT.user;
      if (!ns) throw new Error('Namespace User/user not found in runtime');
      if (typeof ns.get !== 'function') throw new Error('user.get is not a function');
    },
  },

  {
    name: 'user.get — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.User.get?.("myKey");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
