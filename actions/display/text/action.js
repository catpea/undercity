/**
 * display.text — set plain text in a selector.
 * Runtime implementation (injected into generated app via registerNamespace).
 */
export function text(selector, text) {
  document.querySelectorAll(selector).forEach(el => {
    el.textContent = String(text ?? '');
  });
}
