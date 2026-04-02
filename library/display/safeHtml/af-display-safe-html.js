// library/display/safeHtml/af-display-safe-html.js
//
// <af-display-safe-html html="<b>Bold</b>">
//
// Observed attributes:
//   html — sanitized HTML string (caller is responsible for sanitization)
//
// Renders a <div> with the supplied HTML as innerHTML.
// Sanitization (stripping scripts / event attributes) is done by the caller
// before setting the attribute, so this component needs no renderer import
// and works in any module context.
// Light DOM — page styles apply naturally.

import { Signal } from 'framework';
import { Scope }  from 'scope';

class AfDisplaySafeHtml extends HTMLElement {
  static observedAttributes = ['html'];
  #html  = new Signal('');
  #scope = new Scope();

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'html') this.#html.value = next ?? '';
  }

  connectedCallback() {
    this.#scope.add(this.#html.subscribe(html => {
      this.innerHTML = '';
      const div = document.createElement('div');
      div.innerHTML = html;
      this.appendChild(div);
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }
}

customElements.define('af-display-safe-html', AfDisplaySafeHtml);
export { AfDisplaySafeHtml };
