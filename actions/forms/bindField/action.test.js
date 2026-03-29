/**
 * action.test.js — form.bindField
 * Runs in the Undercity testbench (browser) via /api/actions/tests.
 */
import { describe, it, assert } from '/src/lib/testbench.js';

describe('form.bindField', () => {
  it('has correct metadata', async () => {
    const res  = await fetch('/actions/forms/bindField/action.json');
    const meta = await res.json();
    assert.equal(meta.id,       'form.bindField');
    assert.equal(meta.category, 'forms');
    assert(Array.isArray(meta.params), 'params must be an array');
    const keys = meta.params.map(p => p.name);
    assert(keys.includes('name'),  'must have name param');
    assert(keys.includes('key'),   'must have key param');
    assert(meta.params.find(p => p.name === 'key')?.type === 'inventory-key',
      'key param must be inventory-key type');
  });
});
