/**
 * action.test.js — Unit tests for form.getRange
 * Get Range Slider: Read the current value of a range input.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'form.getRange — is exported from runtime',
    run(RT) {
      const ns = RT.Form ?? RT.form;
      if (!ns) throw new Error('Namespace Form/form not found in runtime');
      if (typeof ns.getRange !== 'function') throw new Error('form.getRange is not a function');
    },
  },

  {
    name: 'form.getRange — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Form.getRange?.("");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
