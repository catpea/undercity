/**
 * action.test.js — Unit tests for media.askAudioUpload
 * Ask for Audio Upload: Open file picker for audio. Shows waveform preview.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'media.askAudioUpload — is exported from runtime',
    run(RT) {
      const ns = RT.Media ?? RT.media;
      if (!ns) throw new Error('Namespace Media/media not found in runtime');
      if (typeof ns.askAudioUpload !== 'function') throw new Error('media.askAudioUpload is not a function');
    },
  },

  {
    name: 'media.askAudioUpload — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Media.askAudioUpload?.("Upload audio", "audio/*");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
