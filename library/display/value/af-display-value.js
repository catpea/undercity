// library/display/value/af-display-value.js
//
// <af-display-value key="username">
//
// Observed attributes:
//   key — Inventory key to subscribe to and render (required)
//
// Reactively renders the typed value stored in globalThis.Inventory[key]:
//   image  → <img class="img-fluid">
//   audio  → <audio controls>
//   video  → <video controls>
//   file   → <a download> link
//   scalar → <p class="mb-2">
//   empty  → <p class="text-muted fst-italic">(empty)</p>
//
// Uses Signal + named child scope for safe Inventory rebinding when key changes.
// Light DOM — page styles apply naturally.

import { Signal } from 'framework';
import { Scope }  from 'scope';

class AfDisplayValue extends HTMLElement {
  static observedAttributes = ['key'];
  #key   = new Signal('');
  #scope = new Scope();

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key') {
      this.#key.value = next ?? '';
      if (this.isConnected) this.#bindInventory();
    }
  }

  connectedCallback() {
    this.#scope.add(this.#key.subscribe(() => {
      this.#bindInventory();
    }, false));
    this.#bindInventory();
  }

  disconnectedCallback() { this.#scope.dispose(); }

  #bindInventory() {
    const key = this.#key.peek();
    const inv = this.#scope.scope('inv');
    inv.dispose();
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') {
      this.#renderValue(undefined);
      return;
    }
    inv.add(globalThis.Inventory.subscribe(key, v => this.#renderValue(v)));
  }

  #renderValue(v) {
    this.innerHTML = '';

    // Empty check
    if (v == null || v === '') {
      const p = document.createElement('p');
      p.className   = 'text-muted fst-italic';
      p.textContent = '(empty)';
      this.appendChild(p);
      return;
    }

    const type = typeof v === 'object' && v !== null ? v.type ?? '' : '';

    // Image
    if (type.startsWith('image/') || (typeof v === 'object' && v.url && type.startsWith('image'))) {
      const img = document.createElement('img');
      img.className = 'img-fluid';
      img.src       = v.url ?? String(v);
      img.alt       = v.name ?? '';
      this.appendChild(img);
      return;
    }

    // Audio
    if (type.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src      = v.url ?? String(v);
      this.appendChild(audio);
      return;
    }

    // Video
    if (type.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true;
      video.src      = v.url ?? String(v);
      this.appendChild(video);
      return;
    }

    // Generic file with URL
    if (typeof v === 'object' && v.url) {
      const a = document.createElement('a');
      a.href     = v.url;
      a.download = v.name ?? 'download';
      a.textContent = v.name ?? v.url;
      this.appendChild(a);
      return;
    }

    // Scalar (string, number, boolean)
    const p = document.createElement('p');
    p.className   = 'mb-2';
    p.textContent = String(v);
    this.appendChild(p);
  }
}

customElements.define('af-display-value', AfDisplayValue);
export { AfDisplayValue };
