/**
 * action.test.js — Tests for render.field
 */
import { field } from './action.js';

export const tests = [

  {
    name: 'render.field — exported from runtime',
    run(RT) {
      if (!RT.Render?.field) throw new Error('RT.Render.field not found');
    },
  },

  {
    name: 'render.field — appends label and input',
    run() {
      field('email', 'Email Address', 'email', 'you@example.com');
      const ct = document.getElementById('pw-content');
      const label = ct.querySelector('label');
      const input = ct.querySelector('input[type="email"]');
      if (!label) throw new Error('No <label>');
      if (!label.textContent.includes('Email Address')) throw new Error(`Label: ${label.textContent}`);
      if (!input) throw new Error('No <input type="email">');
      if (input.name !== 'email') throw new Error(`input.name: ${input.name}`);
      if (!input.placeholder.includes('you@example.com')) throw new Error(`placeholder: ${input.placeholder}`);
    },
  },

  {
    name: 'render.field — required flag sets required attr',
    run() {
      field('pw', 'Password', 'password', '', '', true);
      const input = document.getElementById('pw-content').querySelector('input[type="password"]');
      if (!input?.required) throw new Error('Expected required');
    },
  },

  {
    name: 'render.field — has form-control class',
    run() {
      field('username', 'Username');
      const input = document.getElementById('pw-content').querySelector('input');
      if (!input?.classList.contains('form-control')) throw new Error('Missing form-control');
    },
  },

  {
    name: 'render.field — error div has correct data-error attr',
    run() {
      field('myfield', 'My Field');
      const errDiv = document.getElementById('pw-content').querySelector('[data-error="myfield"]');
      if (!errDiv) throw new Error('No element with data-error="myfield"');
    },
  },

];
