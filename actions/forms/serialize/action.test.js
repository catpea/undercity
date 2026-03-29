/**
 * action.test.js — Unit tests for form.serialize
 * Serialize Form: Collect all fields of a form into an inventory key.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'form.serialize — is exported from runtime',
    run(RT) {
      const ns = RT.Form ?? RT.form;
      if (!ns) throw new Error('Namespace Form/form not found in runtime');
      if (typeof ns.serialize !== 'function') throw new Error('form.serialize is not a function');
    },
  },

  {
    name: 'form.serialize — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Form.serialize?.("#my-form");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
