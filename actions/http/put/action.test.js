/**
 * action.test.js — Unit tests for http.put
 * HTTP PUT: PUT JSON body to a URL.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'http.put — is exported from runtime',
    run(RT) {
      const ns = RT.Http ?? RT.http;
      if (!ns) throw new Error('Namespace Http/http not found in runtime');
      if (typeof ns.put !== 'function') throw new Error('http.put is not a function');
    },
  },

  {
    name: 'http.put — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Http.put?.("", "");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
