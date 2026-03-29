/**
 * action.test.js — Unit tests for http.post
 * HTTP POST: POST JSON body to a URL.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'http.post — is exported from runtime',
    run(RT) {
      const ns = RT.Http ?? RT.http;
      if (!ns) throw new Error('Namespace Http/http not found in runtime');
      if (typeof ns.post !== 'function') throw new Error('http.post is not a function');
    },
  },

  {
    name: 'http.post — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Http.post?.("\"/api/login\"", "{ email, password }");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
