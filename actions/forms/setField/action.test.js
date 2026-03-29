/**
 * action.test.js — Unit tests for form.setField
 * Set Field Value: Programmatically set a form field value.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'form.setField — is exported from runtime',
    run(RT) {
      const ns = RT.Form ?? RT.form;
      if (!ns) throw new Error('Namespace Form/form not found in runtime');
      if (typeof ns.setField !== 'function') throw new Error('form.setField is not a function');
    },
  },

  {
    name: 'form.setField — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Form.setField?.("", "");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
