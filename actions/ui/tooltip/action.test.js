/**
 * action.test.js — Unit tests for ui.tooltip
 * Show Tooltip: Programmatically show a Bootstrap tooltip.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'ui.tooltip — is exported from runtime',
    run(RT) {
      const ns = RT.Ui ?? RT.ui;
      if (!ns) throw new Error('Namespace Ui/ui not found in runtime');
      if (typeof ns.tooltip !== 'function') throw new Error('ui.tooltip is not a function');
    },
  },

  {
    name: 'ui.tooltip — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Ui.tooltip?.("");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
