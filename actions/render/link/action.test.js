/**
 * action.test.js — Unit tests for render.link
 * Link / Text Link: Append a small centred text link that navigates to a room.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'render.link — is exported from runtime',
    run(RT) {
      const ns = RT.Render ?? RT.render;
      if (!ns) throw new Error('Namespace Render/render not found in runtime');
      if (typeof ns.link !== 'function') throw new Error('render.link is not a function');
    },
  },

  {
    name: 'render.link — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Render.link?.("Forgot password?", "forgot", "");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
