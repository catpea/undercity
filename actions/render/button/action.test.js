/**
 * action.test.js — Tests for render.button
 */
import { button } from './action.js';

export const tests = [

  {
    name: 'render.button — exported from runtime',
    run(RT) {
      if (!RT.Render?.button) throw new Error('RT.Render.button not found');
    },
  },

  {
    name: 'render.button — appends <button> with label and primary class',
    run() {
      button('Sign In', 'auth-check', 'primary', true);
      const btn = document.getElementById('pw-content').querySelector('button');
      if (!btn) throw new Error('No button');
      if (!btn.textContent.includes('Sign In')) throw new Error(`Label: ${btn.textContent}`);
      if (!btn.classList.contains('btn-primary')) throw new Error('Missing btn-primary');
      if (!btn.classList.contains('w-100')) throw new Error('Missing w-100 (full=true)');
    },
  },

  {
    name: 'render.button — full=false omits w-100',
    run() {
      button('Back', 'lobby', 'outline-secondary', false);
      const btn = document.getElementById('pw-content').querySelector('button');
      if (!btn) throw new Error('No button');
      if (btn.classList.contains('w-100')) throw new Error('Should not have w-100 when full=false');
    },
  },

];
