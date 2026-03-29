/**
 * action.test.js — Unit tests for form.submit
 * Submit Form: Programmatically submit a form element.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'form.submit — is exported from runtime',
    run(RT) {
      const ns = RT.Form ?? RT.form;
      if (!ns) throw new Error('Namespace Form/form not found in runtime');
      if (typeof ns.submit !== 'function') throw new Error('form.submit is not a function');
    },
  },

  {
    name: 'form.submit — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Form.submit?.("#my-form");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
