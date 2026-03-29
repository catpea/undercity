const ICON_TEMPLATE = document.createElement('template');
ICON_TEMPLATE.innerHTML = `
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

const iconCache = new Map();

function resolveIconBase() {
  const configured =
    document.documentElement?.dataset?.afIconBase ||
    window.AF_ICON_BASE ||
    '../icons/';
  return new URL(configured, document.baseURI).href;
}

async function loadIcon(name) {
  if (!iconCache.has(name)) {
    iconCache.set(name, (async () => {
      const url = new URL(`${encodeURIComponent(name)}.svg`, resolveIconBase());
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Icon "${name}" not found at ${url.pathname}`);
      }

      const text = await res.text();
      const tpl = document.createElement('template');
      tpl.innerHTML = text.trim();
      const svg = tpl.content.querySelector('svg');
      if (!svg) throw new Error(`Icon "${name}" is not a valid SVG`);
      svg.setAttribute('part', 'svg');
      return svg;
    })());
  }

  return iconCache.get(name);
}

class AFIcon extends HTMLElement {
  static observedAttributes = ['name', 'aria-label'];

  #container;
  #renderToken = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(ICON_TEMPLATE.content.cloneNode(true));
    this.#container = root.querySelector('[part="container"]');
  }

  get name() {
    return this.getAttribute('name') ?? '';
  }

  set name(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('name');
    else this.setAttribute('name', value);
  }

  connectedCallback() {
    this.#syncA11y();
    this.#render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'aria-label') this.#syncA11y();
    if (name === 'name' && this.isConnected) this.#render();
  }

  #syncA11y() {
    if (this.hasAttribute('aria-label')) {
      this.setAttribute('role', 'img');
      this.removeAttribute('aria-hidden');
      return;
    }

    this.removeAttribute('role');
    this.setAttribute('aria-hidden', 'true');
  }

  async #render() {
    const token = ++this.#renderToken;
    const name = this.name.trim();

    if (!name) {
      this.#container.replaceChildren();
      return;
    }

    try {
      const svg = await loadIcon(name);
      if (token !== this.#renderToken) return;
      this.#container.replaceChildren(svg.cloneNode(true));
    } catch (err) {
      if (token !== this.#renderToken) return;
      console.warn('[af-icon]', err.message);
      this.#container.replaceChildren();
    }
  }
}

if (!customElements.get('af-icon')) {
  customElements.define('af-icon', AFIcon);
}

export { AFIcon };
