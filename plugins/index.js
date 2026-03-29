/**
 * plugins/index.js — Plugin registry and loader.
 *
 * Plugins are plain objects that implement an `install(registry)` method.
 * The registry exposes hooks that the generator calls during code generation.
 *
 * Registered hooks (in call order during generation):
 *   addTemplate(name, fn)          — fn(proj, node, outEdges, nodes) → HTML string
 *   addRuntimeExtension(fn)        — fn(proj) → JS string (appended to runtime.js)
 *   addCSSExtension(fn)            — fn(proj) → CSS string (merged into flow.css)
 *   addAfterGenerate(fn)           — async fn(proj, outDir, files) — post-write hook
 *
 * All built-in plugins are registered below. To disable one, remove its import.
 */

import FormsPlugin     from './forms.js';
import WizardPlugin    from './wizard.js';
import MultipagePlugin from './multipage.js';

// ── Registry ──────────────────────────────────────────────────────────────────

class PluginRegistry {
  #templates       = new Map();   // name → fn(proj, node, outEdges, nodes)
  #runtimeExts     = [];          // fn(proj) → string
  #cssExts         = [];          // fn(proj) → string
  #afterGenerates  = [];          // async fn(proj, outDir, files)
  #plugins         = [];

  /** Register a plugin by calling its install(registry) method. */
  register(plugin) {
    plugin.install(this);
    this.#plugins.push(plugin);
    return this;
  }

  // ── Hook registration (called by plugins) ──────────────────────────

  addTemplate(name, fn)        { this.#templates.set(name, fn); }
  addRuntimeExtension(fn)      { this.#runtimeExts.push(fn); }
  addCSSExtension(fn)          { this.#cssExts.push(fn); }
  addAfterGenerate(fn)         { this.#afterGenerates.push(fn); }

  // ── Hook accessors (called by generator) ───────────────────────────

  /** Look up a registered template by name. Returns null if not found. */
  templateFor(name) {
    return this.#templates.get(name) ?? null;
  }

  /** Collect all runtime extension strings for a given project. */
  runtimeExtensions(proj) {
    return this.#runtimeExts.map(fn => fn(proj)).filter(Boolean);
  }

  /** Collect all CSS extension strings for a given project. */
  cssExtensions(proj) {
    return this.#cssExts.map(fn => fn(proj)).filter(Boolean);
  }

  /** Run all afterGenerate hooks in registration order. */
  async runAfterGenerate(proj, outDir, files) {
    for (const fn of this.#afterGenerates) {
      await fn(proj, outDir, files);
    }
  }

  /** All registered plugins (for introspection / IDE command palette). */
  get plugins() { return [...this.#plugins]; }

  /** Flat list of all command definitions contributed by plugins. */
  get commands() {
    return this.#plugins.flatMap(p => p.commands ?? []);
  }
}

// ── Default registry with all built-in plugins ───────────────────────────────

export const registry = new PluginRegistry()
  .register(FormsPlugin)
  .register(WizardPlugin)
  .register(MultipagePlugin);

export { PluginRegistry };
