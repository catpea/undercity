/**
 * action.test.js — Unit tests for http.get
 * HTTP GET: Fetch JSON from a URL. Stores response in inventory.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'http.get — is exported from runtime',
    run(RT) {
      const ns = RT.Http ?? RT.http;
      if (!ns) throw new Error('Namespace Http/http not found in runtime');
      if (typeof ns.get !== 'function') throw new Error('http.get is not a function');
    },
  },

  {
    name: 'http.get — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Http.get?.("\"/api/user\"");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
