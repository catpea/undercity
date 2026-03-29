/**
 * action.test.js — Unit tests for user.set
 * Set Inventory Item: Store a key/value in the user's inventory.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'user.set — is exported from runtime',
    run(RT) {
      const ns = RT.User ?? RT.user;
      if (!ns) throw new Error('Namespace User/user not found in runtime');
      if (typeof ns.set !== 'function') throw new Error('user.set is not a function');
    },
  },

  {
    name: 'user.set — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.User.set?.("myKey", "\"hello\" or inventory.email");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
