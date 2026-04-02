// ── Display ───────────────────────────────────────────────────────────────────
// Writes content into EXISTING elements already on the page.
// Works on arbitrary CSS selectors — does not create new DOM elements.
import { Inventory }                    from './inventory.js';
import { _renderMd, _sanitizeHtml }     from './md-renderer.js';

export const Display = {
  /** Set plain text (safe, no HTML interpretation). */
  text(selector, text) {
    document.querySelectorAll(selector).forEach(el => { el.textContent = String(text ?? ''); });
  },
  /** Render Markdown into a selector (wraps content in div.af-md). */
  markdown(selector, content) {
    const html = _renderMd(String(content ?? ''));
    document.querySelectorAll(selector).forEach(el => {
      el.innerHTML = `<div class="af-md">${html}</div>`;
    });
  },
  /** Inject sanitized HTML (strips scripts/event-handlers). */
  safeHtml(selector, html) {
    const safe = _sanitizeHtml(String(html ?? ''));
    document.querySelectorAll(selector).forEach(el => { el.innerHTML = safe; });
  },
  /** Inject raw trusted HTML directly (no sanitization). */
  rawHtml(selector, html) {
    document.querySelectorAll(selector).forEach(el => { el.innerHTML = String(html ?? ''); });
  },
  /** Empty the contents of a selector. */
  clear(selector) {
    document.querySelectorAll(selector).forEach(el => { el.innerHTML = ''; });
  },
  /** Print an inventory key's value as text into a selector. */
  value(selector, key) {
    const v = Inventory.get(key);
    Display.text(selector, v ?? '');
  },
};
