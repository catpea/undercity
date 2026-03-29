/**
 * history.js — Snapshot-based undo/redo for the Undercity IDE.
 *
 * Usage:
 *   history.record(graph.toJSON())  // call BEFORE mutating
 *   const prev = history.undo(graph.toJSON())   // returns state to restore
 *   const next = history.redo(graph.toJSON())   // returns state to restore
 */
export class CommandHistory {
  #undo  = [];
  #redo  = [];
  static MAX = 80;

  /** Save the current state before a mutation so it can be undone. */
  record(snapshot) {
    this.#undo.push(snapshot);
    if (this.#undo.length > CommandHistory.MAX) this.#undo.shift();
    this.#redo.length = 0; // new action clears redo stack
  }

  /**
   * Undo: returns snapshot to restore, or null if nothing to undo.
   * @param {object} current - current graph JSON (pushed to redo stack)
   */
  undo(current) {
    if (!this.#undo.length) return null;
    this.#redo.push(current);
    return this.#undo.pop();
  }

  /**
   * Redo: returns snapshot to restore, or null if nothing to redo.
   * @param {object} current - current graph JSON (pushed to undo stack)
   */
  redo(current) {
    if (!this.#redo.length) return null;
    this.#undo.push(current);
    return this.#redo.pop();
  }

  get canUndo() { return this.#undo.length > 0; }
  get canRedo() { return this.#redo.length > 0; }

  /** Reset history (e.g. when a new project is opened). */
  clear() { this.#undo.length = 0; this.#redo.length = 0; }
}
