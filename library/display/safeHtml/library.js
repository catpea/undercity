// library/display/safeHtml/library.js
import { Emitter } from 'framework';

function sanitize(html) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');

  // Remove all script elements
  for (const el of doc.querySelectorAll('script')) el.remove();

  // Strip on* event attributes from every element
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const attrs = Array.from(node.attributes);
      for (const attr of attrs) {
        if (attr.name.toLowerCase().startsWith('on')) {
          node.removeAttribute(attr.name);
        }
      }
    }
    node = walker.nextNode();
  }

  return doc.body.innerHTML;
}

export function run(params, ctx) {
  const emitter = new Emitter();

  try {
    const el = document.querySelector(params.selector);
    if (!el) throw new Error(`display.safeHtml: selector not found: ${params.selector}`);
    el.innerHTML = sanitize(params.html ?? '');
    emitter.emit('done');
  } catch (err) {
    emitter.emit('error', err);
  }

  return emitter;
}
