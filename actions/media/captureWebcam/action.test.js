/**
 * action.test.js — Unit tests for media.captureWebcam
 * Capture from Webcam: Ask camera permission and capture a still photo.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'media.captureWebcam — is exported from runtime',
    run(RT) {
      const ns = RT.Media ?? RT.media;
      if (!ns) throw new Error('Namespace Media/media not found in runtime');
      if (typeof ns.captureWebcam !== 'function') throw new Error('media.captureWebcam is not a function');
    },
  },

  {
    name: 'media.captureWebcam — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Media.captureWebcam?.("Take a photo");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
