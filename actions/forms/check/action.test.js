/**
 * action.test.js — Unit tests for form.check
 * Get Checkbox / Radio: Read checked state of a checkbox or radio group.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'form.check — is exported from runtime',
    run(RT) {
      const ns = RT.Form ?? RT.form;
      if (!ns) throw new Error('Namespace Form/form not found in runtime');
      if (typeof ns.check !== 'function') throw new Error('form.check is not a function');
    },
  },

  {
    name: 'form.check — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Form.check?.("");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
