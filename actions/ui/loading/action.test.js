/**
 * action.test.js — Unit tests for ui.loading
 * Loading Spinner: Show or hide a full-screen loading overlay.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'ui.loading — is exported from runtime',
    run(RT) {
      const ns = RT.Ui ?? RT.ui;
      if (!ns) throw new Error('Namespace Ui/ui not found in runtime');
      if (typeof ns.loading !== 'function') throw new Error('ui.loading is not a function');
    },
  },

  {
    name: 'ui.loading — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Ui.loading?.(true);
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
