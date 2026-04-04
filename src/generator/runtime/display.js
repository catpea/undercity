// ── Display ───────────────────────────────────────────────────────────────────
// Appends content into the current card — a form builder, not an HTML editor.
// Content flows naturally into the page; no CSS selectors needed.
// Use Display.divider() to close the current card and begin a new section.
//
// All display methods create named web components so that generated page source
// is readable and self-documenting.
import { _renderMd, _sanitizeHtml }             from './md-renderer.js';
import { _pwCardBody, _pwContainer, _pwInsert } from './page-helpers.js';

export const Display = {

  /** Append plain text as <af-display-text>. */
  text({ text } = {}) {
    const el = document.createElement('af-display-text');
    el.setAttribute('content', String(text ?? ''));
    _pwCardBody().appendChild(el);
  },

  /** Append rendered Markdown as <af-display-markdown>. */
  markdown({ content } = {}) {
    const el = document.createElement('af-display-markdown');
    el.setAttribute('html', _renderMd(String(content ?? '')));
    _pwCardBody().appendChild(el);
  },

  /** Append sanitized HTML (scripts stripped) as <af-display-safe-html>. */
  safeHtml({ html } = {}) {
    const el = document.createElement('af-display-safe-html');
    el.setAttribute('html', _sanitizeHtml(String(html ?? '')));
    _pwCardBody().appendChild(el);
  },

  /** Append raw trusted HTML as <af-display-raw-html>. */
  rawHtml({ html } = {}) {
    const el = document.createElement('af-display-raw-html');
    el.setAttribute('html', String(html ?? ''));
    _pwCardBody().appendChild(el);
  },

  /** Reactively render the current value of an Inventory key as <af-display-value>. */
  value({ key } = {}) {
    const el = document.createElement('af-display-value');
    el.setAttribute('key', String(key ?? ''));
    _pwCardBody().appendChild(el);
  },

  /** Remove all content cards — call at the top of Enter to rebuild the page. */
  clear(_params) {
    const root  = _pwContainer();
    const cards = [...root.querySelectorAll(':scope > .card:not(#pw-nav-card)')];
    cards.forEach(c => c.remove());
  },

  /** Close the current card and open a new one — divides content into sections. */
  divider(_params) {
    const card = document.createElement('div');
    card.className = 'card mb-3';
    const body = document.createElement('div');
    body.className = 'card-body';
    card.appendChild(body);
    _pwInsert(_pwContainer(), card);
  },
};
