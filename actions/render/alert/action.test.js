/**
 * action.test.js — Unit tests for render.alert
 * Alert Box: Append a hidden Bootstrap alert (show via display.text or form errors).
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'render.alert — is exported from runtime',
    run(RT) {
      const ns = RT.Render ?? RT.render;
      if (!ns) throw new Error('Namespace Render/render not found in runtime');
      if (typeof ns.alert !== 'function') throw new Error('render.alert is not a function');
    },
  },

  {
    name: 'render.alert — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Render.alert?.("login-alert", "danger", "");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
