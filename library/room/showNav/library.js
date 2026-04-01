// library/room/showNav/library.js
import { Emitter } from 'framework';

export function run(params, ctx) {
  const emitter = new Emitter();

  try {
    const nav     = window._PW_NAV ?? [];
    const variant = params.variant ?? 'primary';
    const full    = params.full    ?? true;

    const container = document.createElement('div');
    container.className = 'uc-nav-buttons';

    for (const item of nav) {
      const btn = document.createElement('a');
      btn.href      = item.href ?? '#';
      btn.textContent = item.label ?? item.href ?? 'Continue';
      btn.className = [
        'btn',
        `btn-${variant}`,
        full ? 'w-100' : '',
      ].filter(Boolean).join(' ');
      if (item.target) btn.target = item.target;
      container.append(btn);
    }

    ctx.container.append(container);
    emitter.emit('done');
  } catch (err) {
    emitter.emit('error', err);
  }

  return emitter;
}
