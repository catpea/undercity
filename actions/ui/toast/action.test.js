/**
 * action.test.js — Unit tests for ui.toast
 * Show Toast: Show a transient notification overlay.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'ui.toast — is exported from runtime',
    run(RT) {
      const ns = RT.Ui ?? RT.ui;
      if (!ns) throw new Error('Namespace Ui/ui not found in runtime');
      if (typeof ns.toast !== 'function') throw new Error('ui.toast is not a function');
    },
  },

  {
    name: 'ui.toast — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Ui.toast?.("", "info");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
