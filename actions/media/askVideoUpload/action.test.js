/**
 * action.test.js — Tests for media.askVideoUpload
 * Tests verify that the upload UI is rendered correctly in the DOM.
 */
import { askVideoUpload } from './action.js';

export const tests = [

  {
    name: 'media.askVideoUpload — exported from runtime',
    run(RT) {
      if (!RT.Media?.askVideoUpload) throw new Error('RT.Media.askVideoUpload not found');
    },
  },

  {
    name: 'media.askVideoUpload — renders upload card with file input',
    run() {
      const promise = askVideoUpload('Upload your video', 'video/*', '', false);

      const ct = document.getElementById('pw-content');
      const card = ct.querySelector('.pw-media-wrap');
      if (!card) throw new Error('Expected .pw-media-wrap in #pw-content');

      const input = card.querySelector('input[type="file"]');
      if (!input) throw new Error('Expected file <input>');
      if (input.accept !== 'video/*') throw new Error(`accept="${input.accept}", expected "video/*"`);

      const prompt = card.querySelector('p');
      if (!prompt?.textContent.includes('Upload your video'))
        throw new Error(`Prompt text: "${prompt?.textContent}"`);

      card.remove();
      promise.catch(() => {});
    },
  },

  {
    name: 'media.askVideoUpload — renders prompt label',
    run() {
      const promise = askVideoUpload('Choose a video file');
      const card = document.getElementById('pw-content').querySelector('.pw-media-wrap');
      const p = card?.querySelector('p');
      if (!p?.textContent.includes('Choose a video file'))
        throw new Error(`Prompt: "${p?.textContent}"`);
      card?.remove();
      promise.catch(() => {});
    },
  },

];
