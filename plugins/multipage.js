/**
 * plugins/multipage.js — Multi-page transition plugin.
 *
 * Wraps all page-to-page navigation in CSS animations so the generated
 * app feels like a native SPA. The transition style is set on the project:
 *   proj.meta.transition = 'fade' | 'slide' | 'push' | 'zoom' | 'none'
 *
 * How it works:
 *   1. Replaces Navigator.goto() with a version that applies an exit class,
 *      waits for its CSS animation, then navigates.
 *   2. Adds an enter animation that plays automatically when each page loads
 *      (via a CSS animation on body.pw-page).
 *   3. Writes a transitions.css alongside flow.css.
 *
 * Usage: set `proj.meta.transition = 'fade'` in your project and enable the plugin.
 */

// ── CSS bundles per transition type ──────────────────────────────────────────

const TRANSITIONS = {
  fade: `
/* ── Fade transition ─────────────────────────────────────────────────────── */
body.pw-page {
  animation: pw-enter-fade 0.28s ease-out;
}
body.pw-exit {
  animation: pw-exit-fade 0.22s ease-in forwards;
  pointer-events: none;
}
@keyframes pw-enter-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes pw-exit-fade {
  from { opacity: 1; }
  to   { opacity: 0; }
}`,

  slide: `
/* ── Slide transition (right→left) ────────────────────────────────────────── */
body.pw-page {
  animation: pw-enter-slide 0.3s cubic-bezier(.25,.46,.45,.94);
}
body.pw-exit {
  animation: pw-exit-slide 0.25s cubic-bezier(.55,.06,.68,.19) forwards;
  pointer-events: none;
}
@keyframes pw-enter-slide {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0);    }
}
@keyframes pw-exit-slide {
  from { opacity: 1; transform: translateX(0);     }
  to   { opacity: 0; transform: translateX(-40px); }
}`,

  push: `
/* ── Push transition (scale + slide) ────────────────────────────────────── */
body.pw-page {
  animation: pw-enter-push 0.32s cubic-bezier(.22,.61,.36,1);
}
body.pw-exit {
  animation: pw-exit-push 0.24s ease-in forwards;
  pointer-events: none;
}
@keyframes pw-enter-push {
  from { opacity: 0; transform: scale(.96) translateY(16px); }
  to   { opacity: 1; transform: scale(1)   translateY(0);    }
}
@keyframes pw-exit-push {
  from { opacity: 1; transform: scale(1)    translateY(0);    }
  to   { opacity: 0; transform: scale(1.03) translateY(-8px); }
}`,

  zoom: `
/* ── Zoom transition ────────────────────────────────────────────────────── */
body.pw-page {
  animation: pw-enter-zoom 0.28s ease-out;
}
body.pw-exit {
  animation: pw-exit-zoom 0.22s ease-in forwards;
  pointer-events: none;
}
@keyframes pw-enter-zoom {
  from { opacity: 0; transform: scale(.94); }
  to   { opacity: 1; transform: scale(1);   }
}
@keyframes pw-exit-zoom {
  from { opacity: 1; transform: scale(1);    }
  to   { opacity: 0; transform: scale(1.05); }
}`,

  none: '',
};

// ── Runtime extension ─────────────────────────────────────────────────────────

function buildRuntimeExtension(proj) {
  const type     = proj.meta?.transition ?? 'fade';
  const duration = proj.meta?.transitionDuration ?? 240;

  return `
// ── Transitions (injected by multipage plugin) ────────────────────────────
export const Transition = (() => {
  const TYPE     = '${type}';
  const DURATION = ${duration};

  async function go(room) {
    if (TYPE === 'none') { _origGoto(room); return; }
    document.body.classList.add('pw-exit');
    await new Promise(r => setTimeout(r, DURATION));
    _origGoto(room);
  }

  // Override Navigator — capture original first, then replace
  const _origGoto = Navigator.goto;
  Navigator.goto = go;

  return { type: TYPE, duration: DURATION, goto: go };
})();`;
}

// ── afterGenerate hook: write transitions.css ─────────────────────────────────

async function afterGenerate(proj, outDir, _files) {
  const type = proj.meta?.transition ?? 'fade';
  const css  = TRANSITIONS[type] ?? TRANSITIONS.fade;
  if (!css.trim()) return; // no transitions for 'none'

  const { writeFile } = await import('fs/promises');
  const { join }      = await import('path');
  await writeFile(join(outDir, 'css', 'transitions.css'), css.trimStart(), 'utf8');
}

// ── CSS injection into flow.css ───────────────────────────────────────────────

function buildCSSExtension(proj) {
  const type = proj.meta?.transition ?? 'fade';
  return TRANSITIONS[type] ?? '';
}

// ── Plugin manifest ───────────────────────────────────────────────────────────

const MultipagePlugin = {
  name:        'multipage',
  version:     '1.0.0',
  description: 'Animated page transitions for multi-page generated apps',

  install(registry) {
    registry.addRuntimeExtension(buildRuntimeExtension);
    registry.addCSSExtension(buildCSSExtension);
    registry.addAfterGenerate(afterGenerate);
  },

  commands: [
    {
      name:        'set transition',
      category:    'Project',
      description: 'Configure page transition style for generated apps',
      usage:       'set transition <fade|slide|push|zoom|none>',
    },
  ],
};

export default MultipagePlugin;
