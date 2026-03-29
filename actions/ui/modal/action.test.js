/**
 * action.test.js — Unit tests for ui.modal
 * Show Modal: Open a named Bootstrap modal by selector.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'ui.modal — is exported from runtime',
    run(RT) {
      const ns = RT.Ui ?? RT.ui;
      if (!ns) throw new Error('Namespace Ui/ui not found in runtime');
      if (typeof ns.modal !== 'function') throw new Error('ui.modal is not a function');
    },
  },

  {
    name: 'ui.modal — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Ui.modal?.("#my-modal");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
