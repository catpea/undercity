/**
 * action.test.js — Unit tests for media.askFileUpload
 * Ask for File Upload: Open generic file picker. Stores file metadata in inventory.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'media.askFileUpload — is exported from runtime',
    run(RT) {
      const ns = RT.Media ?? RT.media;
      if (!ns) throw new Error('Namespace Media/media not found in runtime');
      if (typeof ns.askFileUpload !== 'function') throw new Error('media.askFileUpload is not a function');
    },
  },

  {
    name: 'media.askFileUpload — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Media.askFileUpload?.("Upload a file", "*/*", false);
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
