/**
 * action.test.js — Unit tests for form.validate
 * Validate Form: Run HTML5 constraint validation and show Bootstrap invalid-feedback.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'form.validate — is exported from runtime',
    run(RT) {
      const ns = RT.Form ?? RT.form;
      if (!ns) throw new Error('Namespace Form/form not found in runtime');
      if (typeof ns.validate !== 'function') throw new Error('form.validate is not a function');
    },
  },

  {
    name: 'form.validate — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Form.validate?.("#my-form");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
