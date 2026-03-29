/**
 * action.test.js — Tests for display.text
 */
import { text } from './action.js';

export const tests = [

  {
    name: 'display.text — exported from runtime',
    run(RT) {
      if (!RT.Display?.text) throw new Error('RT.Display.text not found');
    },
  },

  {
    name: 'display.text — sets textContent of matching element',
    run() {
      const el = document.createElement('p');
      el.id = 'test-display-target';
      document.getElementById('pw-content').appendChild(el);

      text('#test-display-target', 'Hello World');
      if (el.textContent !== 'Hello World') throw new Error(`Got: ${el.textContent}`);
    },
  },

  {
    name: 'display.text — safe: does not render HTML tags',
    run() {
      const el = document.createElement('p');
      el.id = 'test-display-safe';
      document.getElementById('pw-content').appendChild(el);

      text('#test-display-safe', '<b>bold</b>');
      if (el.querySelector('b')) throw new Error('Should not render HTML');
      if (!el.textContent.includes('<b>')) throw new Error('Should show raw tag chars');
    },
  },

];
