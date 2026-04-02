// library/display/rawHtml/af-display-raw-html.js
//
// <af-display-raw-html html="<b>Bold</b>">
//
// Observed attributes:
//   html — trusted HTML string to render directly (defaults to '')
//
// Renders a <div> with raw innerHTML (no sanitization).
// Uses Light DOM so page styles apply naturally.
// Only use with content you fully trust.

import { Signal } from 'framework';
import { Scope }  from 'scope';

class AfDisplayRawHtml extends HTMLElement {
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

customElements.define('af-display-raw-html', AfDisplayRawHtml);
export { AfDisplayRawHtml };
