/**
 * action.test.js — Unit tests for http.delete
 * HTTP DELETE: Send a DELETE request.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'http.delete — is exported from runtime',
    run(RT) {
      const ns = RT.Http ?? RT.http;
      if (!ns) throw new Error('Namespace Http/http not found in runtime');
      if (typeof ns.delete !== 'function') throw new Error('http.delete is not a function');
    },
  },

  {
    name: 'http.delete — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Http.delete?.("");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
