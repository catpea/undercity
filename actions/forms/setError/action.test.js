/**
 * action.test.js — Unit tests for form.setError
 * Set Field Error: Show an error message under a field using [data-error="name"].
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'form.setError — is exported from runtime',
    run(RT) {
      const ns = RT.Form ?? RT.form;
      if (!ns) throw new Error('Namespace Form/form not found in runtime');
      if (typeof ns.setError !== 'function') throw new Error('form.setError is not a function');
    },
  },

  {
    name: 'form.setError — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Form.setError?.("", "");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
