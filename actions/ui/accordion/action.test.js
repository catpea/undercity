/**
 * action.test.js — Unit tests for ui.accordion
 * Toggle Accordion: Open or close a Bootstrap accordion item.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'ui.accordion — is exported from runtime',
    run(RT) {
      const ns = RT.Ui ?? RT.ui;
      if (!ns) throw new Error('Namespace Ui/ui not found in runtime');
      if (typeof ns.accordion !== 'function') throw new Error('ui.accordion is not a function');
    },
  },

  {
    name: 'ui.accordion — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Ui.accordion?.("", true);
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
