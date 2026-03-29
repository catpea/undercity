/**
 * action.test.js — Unit tests for media.askImageUpload
 * Ask for Image Upload: Open file picker for an image. Preview before accepting.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'media.askImageUpload — is exported from runtime',
    run(RT) {
      const ns = RT.Media ?? RT.media;
      if (!ns) throw new Error('Namespace Media/media not found in runtime');
      if (typeof ns.askImageUpload !== 'function') throw new Error('media.askImageUpload is not a function');
    },
  },

  {
    name: 'media.askImageUpload — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Media.askImageUpload?.("Upload an image", "image/*", true);
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
