/**
 * action.test.js — Unit tests for ui.collapse
 * Toggle Collapse: Show or hide a Bootstrap collapse component.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'ui.collapse — is exported from runtime',
    run(RT) {
      const ns = RT.Ui ?? RT.ui;
      if (!ns) throw new Error('Namespace Ui/ui not found in runtime');
      if (typeof ns.collapse !== 'function') throw new Error('ui.collapse is not a function');
    },
  },

  {
    name: 'ui.collapse — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Ui.collapse?.("", true);
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
