// library/display/text/af-display-text.js
//
// <af-display-text content="Hello, world!">
//
// Observed attributes:
//   content — plain text to display (defaults to '')
//
// Renders a <p class="mb-2"> with the given text content.
// Uses Light DOM so page styles apply naturally.

import { Signal } from 'framework';
import { Scope }  from 'scope';

class AfDisplayText extends HTMLElement {
  static observedAttributes = ['content'];
  #content = new Signal('');
  #scope   = new Scope();

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'content') this.#content.value = next ?? '';
  }

  connectedCallback() {
    this.#scope.add(this.#content.subscribe(text => {
      this.innerHTML = '';
      const p = document.createElement('p');
      p.className   = 'mb-2';
      p.textContent = text;
      this.appendChild(p);
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }
}

customElements.define('af-display-text', AfDisplayText);
export { AfDisplayText };
