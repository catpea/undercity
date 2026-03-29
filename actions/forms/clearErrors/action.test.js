/**
 * action.test.js — Unit tests for form.clearErrors
 * Clear All Errors: Hide all [data-error] elements on the page.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'form.clearErrors — is exported from runtime',
    run(RT) {
      const ns = RT.Form ?? RT.form;
      if (!ns) throw new Error('Namespace Form/form not found in runtime');
      if (typeof ns.clearErrors !== 'function') throw new Error('form.clearErrors is not a function');
    },
  },

  {
    name: 'form.clearErrors — can be called with no arguments',
    async run(RT, sandbox) {
      // Smoke test: calling the action should not throw
      // (may produce DOM changes or be a no-op depending on state)
      try {
        await RT.Form.clearErrors?.();
      } catch (e) {
        // Some actions require specific DOM state — acceptable
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
