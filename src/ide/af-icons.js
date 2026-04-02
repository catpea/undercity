// src/ide/af-icons.js
//
// <af-icon name="stars"> — fetches an SVG from the icon base URL and inlines it.
//
// Configuration (checked in order):
//   data-af-icon-base on <html>   e.g. data-af-icon-base="../icons/"
//   window.AF_ICON_BASE           global fallback
//   default                       "../icons/"
//
// Usage
//   <af-icon name="stars"></af-icon>
//   <af-icon name="check-circle" aria-label="Done"></af-icon>

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 1em;
      block-size: 1em;
      color: currentColor;
      line-height: 1;
      vertical-align: -0.125em;
      flex: none;
    }
    svg {
      inline-size: 100%;
      block-size: 100%;
      display: block;
      fill: currentColor;
    }
  </style>
  <span part="container"></span>
`;

/** Shared fetch cache — one promise per resolved URL. */
const cache = new Map();

function iconUrl(name) {
  const base = '/icons/';
  return new URL(`${encodeURIComponent(name)}.svg`, new URL(base, document.baseURI)).href;
}

async function fetchSvg(name) {
  const url = iconUrl(name);
  if (!cache.has(url)) {
    cache.set(url, (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`[af-icon] "${name}" not found (${url})`);
      const text = await res.text();
      const tpl  = document.createElement('template');
      tpl.innerHTML = text.trim();
      const svg = tpl.content.querySelector('svg');
      if (!svg) throw new Error(`[af-icon] "${name}" is not a valid SVG`);
      svg.setAttribute('part', 'svg');
      return svg;
    })());
  }
  return cache.get(url);
}

class AfIcon extends HTMLElement {
  static observedAttributes = ['name', 'aria-label'];

  #container;
  #renderToken = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#container = root.querySelector('[part="container"]');
  }

  get name() { return this.getAttribute('name') ?? ''; }
  set name(v) {
    if (v) this.setAttribute('name', v);
    else   this.removeAttribute('name');
  }

  connectedCallback() {
    this.#syncA11y();
    this.#render();
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'aria-label') this.#syncA11y();
    if (attr === 'name' && this.isConnected) this.#render();
  }

  #syncA11y() {
    if (this.hasAttribute('aria-label')) {
      this.setAttribute('role', 'img');
      this.removeAttribute('aria-hidden');
    } else {
      this.removeAttribute('role');
      this.setAttribute('aria-hidden', 'true');
    }
  }

  async #render() {
    const token = ++this.#renderToken;
    const name  = this.name.trim();
    if (!name) { this.#container.replaceChildren(); return; }
    try {
      const svg = await fetchSvg(name);
      if (token !== this.#renderToken) return;
      this.#container.replaceChildren(svg.cloneNode(true));
    } catch (err) {
      if (token !== this.#renderToken) return;
      console.warn(err.message);
      this.#container.replaceChildren();
    }
  }
}

customElements.define('af-icon', AfIcon);

export { AfIcon };
