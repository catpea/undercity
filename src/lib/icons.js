const ICON_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DEFAULT_ICON_NAME = 'stars';

export const LEGACY_ICON_MAP = Object.freeze({
  '🔐': 'shield-lock',
  '⬜': 'app-indicator',
  '✦': 'stars',
  '✅': 'check-circle',
  '✓': 'check-circle',
  '⚠️': 'exclamation-triangle',
  '⚠': 'exclamation-triangle',
  '📋': 'clipboard-check',
  '✎': 'pencil-square',
  '✏️': 'pencil-square',
  '🤖': 'robot',
  '✨': 'magic',
  '⚡': 'lightning-charge',
  '⌘': 'command',
  '⊡': 'arrows-angle-expand',
  '⟳': 'cursor',
  '●': 'record-circle',
  '◆': 'diamond',
  '◎': 'bullseye',
  '→': 'box-arrow-right',
  '✕': 'x-lg',
  '⧉': 'copy',
  '🧭': 'signpost',
  '🎒': 'backpack',
  '🖼': 'image',
  '🎬': 'film',
  '🌐': 'globe',
  '💬': 'chat-dots',
  '📡': 'broadcast',
  '⚙️': 'gear',
  '💾': 'floppy',
});

function escapeAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function normalizeIconName(value, fallback = DEFAULT_ICON_NAME) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const normalized = trimmed.toLowerCase();
  if (ICON_NAME_RE.test(normalized)) return normalized;

  return LEGACY_ICON_MAP[trimmed] ?? fallback;
}

export function renderAfIcon(value, attrs = {}, fallback = DEFAULT_ICON_NAME) {
  const name = normalizeIconName(value, fallback);
  const parts = [`name="${escapeAttr(name)}"`];

  for (const [key, rawValue] of Object.entries(attrs)) {
    if (rawValue === false || rawValue === null || rawValue === undefined) continue;
    if (rawValue === true) {
      parts.push(key);
      continue;
    }
    parts.push(`${key}="${escapeAttr(rawValue)}"`);
  }

  return `<af-icon ${parts.join(' ')}></af-icon>`;
}
