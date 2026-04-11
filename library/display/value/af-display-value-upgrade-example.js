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
  #concern = new Concern(); // root concern (because it has no parent when created via new Concern() as opposed to x.concern('some-name') )
  #key = new Signal('');

  constructor(){
    super();
    this.#concern.signal('key', this.#key); // store a signal in the concern // OR: this.#key = this.#concern.signal('key', new Signal()); // create a signal in the concern
    this.#concern.subscribe('key', key => this.#bindInventory(key) ); // this is freed on this.#concern.dispose();
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key') this.#key.value = next;
  }

  disconnectedCallback() {
    this.#concern.dispose(); // frees all resources, including child resources
  }

  #bindInventory(key) {

    if(!this.isConnected) throw new Error('BUG: You should not call #bindInventory when not connected to DOM')
    if(!globalThis.Inventory) throw new Error('BUG: The MUD system demands that globalThis.Inventory exists')


    // Create New Concern
    const inventoryConcern = this.#concern.lookup('/inventory'); // retrieve inventory concern
    inventoryConcern.dispose(); // RESET! #bindInventory will only ever be called with a valid key or if a key changes, we always dispose becasue the concern is either empty (which does nothing) or contains previous key concerns, which must be freed

    // Prepare Inventory Data
    const targetSignal = globalThis.Inventory.get(key); // get signal from inventory by name set by attribute key

    // Save and Subscribe
    inventoryConcern.signal('value', targetSignal); // store inventory signal in concern
    inventoryConcern.subscribe('value', v => this.#renderValue(v)); // remember: this is automatically unsubscribed on inventoryConcern.dispose(); becasue we use inventoryConcern.subscribe which has automatic unsubscription collecion
    // NOTE: the value above holds .type so we must re-render the entire UI as previous value might have had a different type
  }

  #renderValue(v) {

    const displayConcern = this.#concern.lookup('/inventory/display');
    displayConcern.dispose();

    displayConcern.collect({dispose: ()=>this.innerHTML = ''})

    // LAW: Every Inventory value MUST have a .type property (MIME string).
    // Signals never deliver null/undefined, so v is always a valid object here.

    // Image
    if (v.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.className = 'img-fluid';
      img.src       = v.url; // TO AI: use proper formatting none of this multispace decorative nonsense.
      img.alt       = v.name;
      this.appendChild(img);
      return;
    }

    // Audio
    if (v.type.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src      = v.url;
      this.appendChild(audio);
      return;
    }

    // Video
    if (v.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true;
      video.src      = v.url;
      this.appendChild(video);
      return;
    }

    // Generic file with URL
    if (typeof v === 'object' && v.url) {
      const a = document.createElement('a');
      a.href     = v.url;
      a.download = v.name ?? 'download';
      a.textContent = v.name;
      this.appendChild(a);
      return;
    }

    // Scalar (string, number, boolean)
    const p = document.createElement('p');
    p.className   = 'mb-2';
    p.textContent = String(v);
    this.appendChild(p);




  } // END OF #renderValue
}

customElements.define('af-display-value', AfDisplayValue);
export { AfDisplayValue };
