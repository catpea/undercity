/**
 * action.test.js — Unit tests for ui.progress
 * Set Progress Bar: Update a Bootstrap progress bar by selector.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'ui.progress — is exported from runtime',
    run(RT) {
      const ns = RT.Ui ?? RT.ui;
      if (!ns) throw new Error('Namespace Ui/ui not found in runtime');
      if (typeof ns.progress !== 'function') throw new Error('ui.progress is not a function');
    },
  },

  {
    name: 'ui.progress — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Ui.progress?.("#my-progress", 0);
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
