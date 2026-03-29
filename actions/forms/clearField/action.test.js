/**
 * action.test.js — Unit tests for form.clearField
 * Clear Field: Reset a field to empty.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'form.clearField — is exported from runtime',
    run(RT) {
      const ns = RT.Form ?? RT.form;
      if (!ns) throw new Error('Namespace Form/form not found in runtime');
      if (typeof ns.clearField !== 'function') throw new Error('form.clearField is not a function');
    },
  },

  {
    name: 'form.clearField — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Form.clearField?.("");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
