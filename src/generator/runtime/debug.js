// ── Debug ─────────────────────────────────────────────────────────────────────
// Developer tools exposed as a runtime namespace in generated pages.
// Called by runPayload() when action names begin with "debug."
import { _pwCardBody } from './page-helpers.js';

export const Debug = {

  // ── Inventory Dump ────────────────────────────────────────────────────────
  // Appends <af-inventory-dump> to the current card body.
  // The component self-subscribes via globalThis.Inventory.subscribeAll()
  // and renders a live reactive table of every key/value in Inventory.
  inventoryDump() {
    const el = document.createElement('af-inventory-dump');
    _pwCardBody().appendChild(el);
  },

};
