/**
 * action.test.js — Unit tests for http.upload
 * Upload File (multipart): POST a file from inventory as multipart/form-data.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'http.upload — is exported from runtime',
    run(RT) {
      const ns = RT.Http ?? RT.http;
      if (!ns) throw new Error('Namespace Http/http not found in runtime');
      if (typeof ns.upload !== 'function') throw new Error('http.upload is not a function');
    },
  },

  {
    name: 'http.upload — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Http.upload?.("", "uploadedVideo", "file");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
