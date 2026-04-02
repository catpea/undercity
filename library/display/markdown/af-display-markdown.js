// library/display/markdown/af-display-markdown.js
//
// <af-display-markdown html="<h1>Hello</h1><p>world</p>">
//
// Observed attributes:
//   html — pre-rendered HTML string (caller is responsible for rendering)
//
// Renders a <div class="af-md mb-2"> with the supplied HTML as innerHTML.
// Rendering (markdown → HTML) is done by the caller before setting the attribute,
// so this component needs no renderer import and works in any module context.
// Light DOM — page styles apply naturally.

import { Signal } from 'framework';
import { Scope }  from 'scope';

class AfDisplayMarkdown extends HTMLElement {
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
      div.className = 'af-md mb-2';
      div.innerHTML = html;
      this.appendChild(div);
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }
}

customElements.define('af-display-markdown', AfDisplayMarkdown);
export { AfDisplayMarkdown };
