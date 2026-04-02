// ── User ────────────────────────────��─────────────────────────���──────────────
// The User is the player navigating the dungeon (the person filling the form).
// In MUD terms: the user inhabits a room (location) and carries an inventory.
//
//   User.location  — current room ID (room the user is standing in)
//   User.carry()   — pick up a named item (rich object) into inventory
//   User.drop()    — discard a carried item
//   User.has()     — check whether an item is currently carried
//   User.inspect() — examine a carried item
//
// User.* also proxies all Inventory methods for backwards compatibility.
import { Inventory } from './inventory.js';
import { History }   from './history.js';
import { Navigator } from './navigator.js';

export const User = (() => {
  return {
    /** Current room ID — read from the page's data-node attribute on <body>. */
    get location() {
      return document.body?.dataset?.node ?? History.peek() ?? null;
    },

    carry(itemId, itemData = {}) {
      Inventory.set(itemId, {
        _isItem: true,
        _carriedAt: new Date().toISOString(),
        ...itemData,
      });
    },

    drop(itemId)     { Inventory.delete(itemId); },
    has(itemId)      { const v = Inventory.get(itemId); return v !== null && v !== undefined && v !== '' && v !== false; },
    inspect(itemId)  { return Inventory.get(itemId); },

    // ── Inventory delegates ───────────────���───────────────────────────────────
    get(key)        { return Inventory.get(key); },
    set(key, value) { Inventory.set(key, value); },
    merge(obj)      { Inventory.merge(obj); },
    delete(key)     { Inventory.delete(key); },
    clear()         { Inventory.clear(); },
    check(expr)     { return Inventory.check(expr); },
    dump()          { return Inventory.dump(); },
  };
})();
