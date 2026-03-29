/**
 * action.test.js — Unit tests for user.carry
 * Carry Form Result: Serialize a form into inventory so the user carries the answers.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'user.carry — is exported from runtime',
    run(RT) {
      const ns = RT.User ?? RT.user;
      if (!ns) throw new Error('Namespace User/user not found in runtime');
      if (typeof ns.carry !== 'function') throw new Error('user.carry is not a function');
    },
  },

  {
    name: 'user.carry — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.User.carry?.("#my-form", "");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
