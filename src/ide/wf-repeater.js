import { Signal, Repeater } from 'framework';
import { Scope } from 'scope';

export const WF_REPEATER_TAG = 'wf-repeater';

class WfRepeater extends HTMLElement {
  #scope = new Scope();
  #items = new Signal([]);
  #source = null;
  #renderItem = null;
  #updateItem = null;
  #removeItem = null;
  #key = 'id';

  set items(value) {
    this.#items.value = Array.isArray(value) ? value : [];
  }

  get items() {
    return this.#items.peek();
  }

  set signal(value) {
    this.#source = value ?? null;
    this.#rebind();
  }

  set renderItem(value) {
    this.#renderItem = typeof value === 'function' ? value : null;
    this.#rebind();
  }

  set updateItem(value) {
    this.#updateItem = typeof value === 'function' ? value : null;
    this.#rebind();
  }

  set removeItem(value) {
    this.#removeItem = typeof value === 'function' ? value : null;
    this.#rebind();
  }

  set key(value) {
    this.#key = value ?? 'id';
    this.#rebind();
  }

  connectedCallback() {
    if (!this.style.display) this.style.display = 'contents';
    this.#rebind();
  }

  disconnectedCallback() {
    this.#scope.dispose();
  }

  #rebind() {
    if (!this.isConnected || !this.#renderItem) return;

    this.#scope.scope('repeater').dispose();
    this.replaceChildren();
    const source = this.#source ?? this.#items;
    this.#scope.scope('repeater').add(new Repeater(
      this,
      source,
      item => this.#renderItem(item),
      {
        key: this.#key,
        update: this.#updateItem,
        remove: this.#removeItem,
      },
    ));
  }
}

if (!customElements.get(WF_REPEATER_TAG)) {
  customElements.define(WF_REPEATER_TAG, WfRepeater);
}

export { WfRepeater };
