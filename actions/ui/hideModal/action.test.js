/**
 * action.test.js — Unit tests for ui.hideModal
 * Hide Modal: Close a named Bootstrap modal.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'ui.hideModal — is exported from runtime',
    run(RT) {
      const ns = RT.Ui ?? RT.ui;
      if (!ns) throw new Error('Namespace Ui/ui not found in runtime');
      if (typeof ns.hideModal !== 'function') throw new Error('ui.hideModal is not a function');
    },
  },

  {
    name: 'ui.hideModal — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Ui.hideModal?.("");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
