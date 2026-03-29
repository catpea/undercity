/**
 * action.test.js — Tests for render.title
 * Imports action.js directly for self-contained testing.
 */
import { title } from './action.js';

export const tests = [

  {
    name: 'render.title — is exported from runtime',
    run(RT) {
      if (!RT.Render?.title) throw new Error('RT.Render.title not found');
    },
  },

  {
    name: 'render.title — appends <h2> with correct text',
    run() {
      title('Hello World');
      const el = document.getElementById('pw-content').querySelector('h2');
      if (!el) throw new Error('Expected <h2> in #pw-content');
      if (!el.textContent.includes('Hello World')) throw new Error(`Got: ${el.textContent}`);
    },
  },

  {
    name: 'render.title — respects custom heading size',
    run() {
      title('Big', 'h1');
      if (!document.getElementById('pw-content').querySelector('h1'))
        throw new Error('Expected <h1>');
    },
  },

  {
    name: 'render.title — has pw-heading class',
    run() {
      title('Styled');
      const el = document.getElementById('pw-content').querySelector('h2');
      if (!el?.classList.contains('pw-heading')) throw new Error('Missing pw-heading class');
    },
  },

];
