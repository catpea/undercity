/**
 * action.test.js — Unit tests for form.getField
 * Get Field Value: Read a form field by name and optionally store in inventory.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'form.getField — is exported from runtime',
    run(RT) {
      const ns = RT.Form ?? RT.form;
      if (!ns) throw new Error('Namespace Form/form not found in runtime');
      if (typeof ns.getField !== 'function') throw new Error('form.getField is not a function');
    },
  },

  {
    name: 'form.getField — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Form.getField?.("email");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
