// library/display/markdown/library.js
import { Emitter } from 'framework';

function markdownToHtml(md) {
  // Process line by line for headings, then handle inline elements.
  const lines  = md.split('\n');
  const output = [];
  let   inPara = false;

  const flushPara = () => {
    if (inPara) { output.push('</p>'); inPara = false; }
  };

  const inline = str =>
    str
      // Bold: **text**
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic: _text_ (not preceded by word char to avoid mid-word matches)
      .replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>')
      // Inline code: `code`
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Links: [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  for (const line of lines) {
    // Blank line
    if (line.trim() === '') {
      flushPara();
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,6})\s+(.*)/);
    if (h) {
      flushPara();
      const level = h[1].length;
      output.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    // Normal text — accumulate into paragraph
    if (!inPara) { output.push('<p>'); inPara = true; }
    output.push(inline(line));
  }

  flushPara();
  return output.join('');
}

export function run(params, ctx) {
  const emitter = new Emitter();

  try {
    const el = document.querySelector(params.selector);
    if (!el) throw new Error(`display.markdown: selector not found: ${params.selector}`);
    el.innerHTML = markdownToHtml(params.content ?? '');
    emitter.emit('done');
  } catch (err) {
    emitter.emit('error', err);
  }

  return emitter;
}
