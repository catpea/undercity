// ── Event Bus ─────────────────────────────────────────────────────────────────
// Lightweight pub/sub. Inventory changes bypass Bus — subscribe directly via
// Inventory.subscribe(key, fn). Bus handles navigation and room events.
export const Bus = (() => {
  const handlers = new Map();
  return {
    on(event, fn)     { const s = handlers.get(event) ?? new Set(); s.add(fn); handlers.set(event, s); return { dispose: () => s.delete(fn) }; },
    off(event, fn)    { handlers.get(event)?.delete(fn); },
    emit(event, data) { for (const fn of handlers.get(event) ?? []) fn(data); },
    once(event, fn)   { const h = Bus.on(event, d => { fn(d); h.dispose(); }); },
  };
})();
