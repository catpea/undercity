// library/debug/inventoryDump/library.js
//
// IDE-side action runner for Debug > Inventory Dump.
// Creates an <af-inventory-dump> element and emits it for Savant to render.
import { Emitter } from 'framework';
import './af-inventory-dump.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el      = document.createElement('af-inventory-dump');
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
