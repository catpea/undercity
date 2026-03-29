/**
 * action.test.js — Unit tests for form.getSelect
 * Get Select Value: Read the selected option value from a <select> element.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'form.getSelect — is exported from runtime',
    run(RT) {
      const ns = RT.Form ?? RT.form;
      if (!ns) throw new Error('Namespace Form/form not found in runtime');
      if (typeof ns.getSelect !== 'function') throw new Error('form.getSelect is not a function');
    },
  },

  {
    name: 'form.getSelect — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Form.getSelect?.("");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
